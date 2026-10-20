import {WALK_COMMAND_MS,WALK_STEP} from '../../shared/physics';

/** The battle HUD sends a walk command every WALK_COMMAND_MS and the server moves up to WALK_STEP px each. */
export const BATTLE_CRAWL_SPEED=WALK_STEP/(WALK_COMMAND_MS/1000);
/** Farther than this the fighter teleported (flight, respawn, a fall snapshot): jump there. */
const SNAP=140;
/** After the last pixel of movement the crawl keeps going this long, so it never stops between steps. */
export const CRAWL_LINGER_MS=140;

/**
 * Battle positions arrive one walk command (three 3 px steps) at a time. Easing a fixed share of the gap each frame made
 * the crawl surge after every step and stall before the next one. Chasing the server position at the
 * crawl speed keeps a steady pace (the painted crawl cycle advances with the distance), and a small
 * boost closes extra lag. The height follows in proportion, so slopes are climbed smoothly too.
 */
export function chaseBattlePosition(from:{x:number;y:number},to:{x:number;y:number},dt:number):{x:number;y:number}{
 const dx=to.x-from.x,dy=to.y-from.y,d=Math.abs(dx);
 if(d>SNAP||Math.abs(dy)>SNAP)return {x:to.x,y:to.y};
 if(d<.01)return {x:to.x,y:from.y+dy*Math.min(1,dt/60)};
 const lag=Math.max(0,d-WALK_STEP),step=Math.min(d,dt/1000*(BATTLE_CRAWL_SPEED+lag*4)),k=step/d;
 return {x:from.x+dx*k,y:from.y+dy*k};
}
