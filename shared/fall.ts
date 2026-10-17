/** Shared presentation clock for a server-confirmed downward displacement. */
export const FALL_GRAVITY=1800;
export interface FighterFall {fromY:number;toY:number;startedAt:number;duration:number;velocity:number;void:boolean;}
export function fallDuration(distance:number,velocity=0){
 const drop=Math.max(0,distance),speed=Math.max(0,velocity);
 return drop===0?0:(Math.sqrt(speed*speed+2*FALL_GRAVITY*drop)-speed)/FALL_GRAVITY*1000;
}
export function createFall(fromY:number,toY:number,startedAt:number,isVoid=false,velocity=0):FighterFall {
 const speed=Math.max(0,velocity);return {fromY,toY:Math.max(fromY,toY),startedAt,duration:fallDuration(toY-fromY,speed),velocity:speed,void:isVoid};
}
export function fallPosition(fall:FighterFall,now:number){
 if(now>=fall.startedAt+fall.duration)return fall.toY;
 const elapsed=Math.max(0,now-fall.startedAt)/1000;
 return Math.min(fall.toY,fall.fromY+fall.velocity*elapsed+.5*FALL_GRAVITY*elapsed*elapsed);
}
export function fallVelocity(fall:FighterFall,now:number){
 if(now>=fall.startedAt+fall.duration)return 0;
 return fall.velocity+FALL_GRAVITY*Math.max(0,now-fall.startedAt)/1000;
}
