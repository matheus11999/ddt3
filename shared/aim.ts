import {WEAPONS} from './catalog';
import type {Weapon} from './catalog';
import {ground,WORLD} from './physics';
import type {Fighter} from './protocol';

const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
export const MAX_AIM_SLOPE=30;

/** Half-width of the ground read under a fighter: about the prone body's length, so a
 * pebble or a one-cell step no longer tips the whole body (user report, 19/10/2026). */
export const SUPPORT_SPAN=30;
const SUPPORT_STEP=3;

/** Fit the support under the feet, ignoring a distant floor across a cliff.
 * Theil–Sen (median of pairwise slopes) over the body's width: a small bump moves
 * only a few of the pairs and leaves the median on the real ground line.
 * Screen Y grows downward; facing into an uphill slope raises the firing arc. */
export function terrainAimOffset(terrain:Uint8Array,fighter:{x:number;y:number;facing:1|-1}):number {
 if(fighter.y>=WORLD.height)return 0;
 const samples:{x:number;y:number}[]=[];
 for(let dx=-SUPPORT_SPAN;dx<=SUPPORT_SPAN;dx+=SUPPORT_STEP){const y=ground(terrain,fighter.x+dx,Math.max(0,fighter.y-48))-fighter.y;if(Math.abs(y)<=48)samples.push({x:dx,y});}
 if(samples.length<5||samples.at(-1)!.x-samples[0].x<SUPPORT_SPAN*.6)return 0;
 const slopes:number[]=[];
 for(let i=0;i<samples.length;i++)for(let j=i+1;j<samples.length;j++){const a=samples[i],b=samples[j];if(b.x-a.x>=SUPPORT_SPAN*.4)slopes.push((b.y-a.y)/(b.x-a.x));}
 if(!slopes.length)return 0;
 slopes.sort((a,b)=>a-b);const mid=slopes.length>>1,gradient=slopes.length%2?slopes[mid]:(slopes[mid-1]+slopes[mid])/2;
 const slope=Math.atan(gradient)*180/Math.PI;
 return Math.round(clamp(-fighter.facing*slope,-MAX_AIM_SLOPE,MAX_AIM_SLOPE))||0;
}

/** The paper plane is not a weapon shot: with flight armed the whole 5–90° envelope opens. */
export const FLIGHT_AIM={minAngle:5,maxAngle:90} as const;
/** Angle range source for a fighter right now: the plane's envelope when flight is armed, else the weapon. */
export function aimSource(fighter:{flightArmed?:boolean;equipment:{weapon:string}}):Pick<Weapon,'minAngle'|'maxAngle'>{
 return fighter.flightArmed?FLIGHT_AIM:WEAPONS.find(weapon=>weapon.id===fighter.equipment.weapon)!;
}

/** Weapon limits describe elevation relative to the supporting ground.
 * The global 5–90° envelope keeps the same forward-facing controls. */
export function weaponAimLimits(weapon:Pick<Weapon,'minAngle'|'maxAngle'>,offset=0){
 const slope=clamp(Number.isFinite(offset)?offset:0,-MAX_AIM_SLOPE,MAX_AIM_SLOPE);
 return {minAngle:clamp(weapon.minAngle+slope,5,90),maxAngle:clamp(weapon.maxAngle+slope,5,90)};
}

export function clampAimAngle(weapon:Pick<Weapon,'minAngle'|'maxAngle'>,offset:number,angle:number){
 const limits=weaponAimLimits(weapon,offset);return clamp(Number.isFinite(angle)?angle:45,limits.minAngle,limits.maxAngle);
}

/** Preserve the arm's relative elevation when a crater changes its support. */
export function adjustAimToTerrain(fighter:Fighter,terrain:Uint8Array){
 const weapon=aimSource(fighter);
 const previous=fighter.aimSlope??0,next=terrainAimOffset(terrain,fighter);
 fighter.aimAngle=clampAimAngle(weapon,next,(fighter.aimAngle??45)+next-previous);fighter.aimSlope=next;
}
