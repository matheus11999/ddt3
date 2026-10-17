import type {Projectile,Shot} from '../../shared/protocol';

export function flightTime(projectile:Projectile){return Number.isFinite(projectile.flightTime)?Math.max(0,projectile.flightTime):projectile.points.length*1000/60;}
export function impactTime(projectile:Projectile){return projectile.delay+flightTime(projectile);}
export function projectileFrame(projectile:Projectile,age:number){return Math.max(0,Math.min(projectile.points.length-1,age/Math.max(1,flightTime(projectile))*(projectile.points.length-1)));}
export function shotClock(shot:Shot,offset:number){return performance.now()-Math.max(0,Date.now()+offset-shot.startedAt);}
export function projectileVisible(shot:Shot,index:number,finished=false){return !shot.hidden&&(!finished||shot.impacted.includes(index));}
export function recoveredImpacts(shot:Shot){return (shot.impacted??[]).flatMap(projectileIndex=>{
 const projectile=shot.projectiles[projectileIndex];if(!projectile||shot.hidden)return [];
 return [{type:'impact' as const,shotId:shot.id,projectileIndex,at:shot.startedAt+impactTime(projectile),hits:shot.hits.filter(hit=>hit.projectileIndex===projectileIndex)}];
});}
