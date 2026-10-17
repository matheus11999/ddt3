import type {MapId} from '../../shared/maps';
import type {Shot} from '../../shared/protocol';
import {crater,impactDig} from '../../shared/physics';
import {impactTime,projectileVisible} from './shotPlayback';

/** Logical impact playback must survive slow frames, tab suspension and remounts. */
export function applyDueImpacts(terrain:Uint8Array,map:MapId,shot:Shot,elapsed:number,applied:Set<number>,finished=false){
 const due=shot.projectiles.map((p,index)=>({p,index,at:impactTime(p)}))
  .filter(({index,at})=>projectileVisible(shot,index,finished)&&!applied.has(index)&&elapsed>=at).sort((a,b)=>a.at-b.at||a.index-b.index);
 let removed=0;
 for(const {p,index} of due){applied.add(index);if(p.kind!=='flight'){const dig=impactDig(p.impact);removed+=crater(terrain,dig.x,dig.y,dig.radius,map);}}
 return {removed,indices:due.map(({index})=>index)};
}
