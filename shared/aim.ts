import {WEAPONS} from './catalog';
import type {Weapon} from './catalog';
import {ground,WORLD} from './physics';
import type {Fighter} from './protocol';

const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
export const MAX_AIM_SLOPE=30;

/** The ground is read at both ends of the lying body (rear SUPPORT_NEAR..SUPPORT_SPAN px behind the
 * feet, front the same ahead), as the median of five samples per end: the body lies along the line
 * between them, so it follows ramps and crater edges, while a pebble or a one-cell step that touches
 * only a sample or two of an end changes nothing (user reports, 19/10/2026). */
export const SUPPORT_SPAN=30;
const SUPPORT_NEAR=18,SUPPORT_STEP=3;

/** Fit the support under the body, ignoring a distant floor across a cliff.
 * Screen Y grows downward; facing into an uphill slope raises the firing arc. */
export function terrainAimOffset(terrain:Uint8Array,fighter:{x:number;y:number;facing:1|-1}):number {
 if(fighter.y>=WORLD.height)return 0;
 const end=(side:1|-1)=>{const heights:number[]=[];for(let d=SUPPORT_NEAR;d<=SUPPORT_SPAN;d+=SUPPORT_STEP){const y=ground(terrain,fighter.x+side*d,Math.max(0,fighter.y-48))-fighter.y;if(Math.abs(y)<=48)heights.push(y);}
  if(heights.length<3)return undefined;heights.sort((a,b)=>a-b);return heights[heights.length>>1];};
 const rear=end(-1),front=end(1);if(rear===undefined||front===undefined)return 0;
 const slope=Math.atan2(front-rear,SUPPORT_NEAR+SUPPORT_SPAN)*180/Math.PI;
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
