import type {MapId} from '../../shared/maps';
import type {Shot} from '../../shared/protocol';
import {crater} from '../../shared/physics';

/** Logical impact playback must survive slow frames, tab suspension and remounts. */
export function applyDueImpacts(terrain:Uint8Array,map:MapId,shot:Shot,elapsed:number,applied:Set<number>){
 const due=shot.projectiles.map((p,index)=>({p,index,at:p.delay+p.points.length*1000/60}))
  .filter(({index,at})=>!applied.has(index)&&elapsed>=at).sort((a,b)=>a.at-b.at||a.index-b.index);
 let removed=0;
 for(const {p,index} of due){applied.add(index);removed+=crater(terrain,p.impact.x,p.impact.y,p.impact.radius,map,p.impact.demolition??0);}
 return {removed,indices:due.map(({index})=>index)};
}
