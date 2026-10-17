import {LOBBY_WALK_SPEED} from '../../shared/lobby';

/** Farther than this the avatar teleported (spawn, channel change): jump there. */
const SNAP=400;

/**
 * Plaza positions arrive as server snapshots every 100 ms. Easing a fixed share
 * of the gap each frame makes the pace surge after every snapshot and crawl at
 * the end, so the legs stutter and shuffle. Chasing the snapshot at the walking
 * speed keeps the pace and the stride steady and ends on a clean stop; a small
 * boost only closes extra lag (a slow frame, a burst of snapshots).
 */
export function chaseLobbyPosition(from:{x:number;y:number},to:{x:number;y:number},dt:number):{x:number;y:number}{
 const dx=to.x-from.x,dy=to.y-from.y,d=Math.hypot(dx,dy);
 if(d<.01||d>SNAP)return {x:to.x,y:to.y};
 const lag=Math.max(0,d-LOBBY_WALK_SPEED*.2),step=Math.min(d,dt/1000*(LOBBY_WALK_SPEED+lag*3));
 return {x:from.x+dx/d*step,y:from.y+dy/d*step};
}
