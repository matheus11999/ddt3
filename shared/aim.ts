import {WEAPONS} from './catalog';
import type {Weapon} from './catalog';
import {ground,WORLD} from './physics';
import type {Fighter} from './protocol';

const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
export const MAX_AIM_SLOPE=30;

/** Fit the support under the feet, ignoring a distant floor across a cliff.
 * Screen Y grows downward; facing into an uphill slope raises the firing arc. */
export function terrainAimOffset(terrain:Uint8Array,fighter:{x:number;y:number;facing:1|-1}):number {
 if(fighter.y>=WORLD.height)return 0;
 const samples=[-12,-6,0,6,12].map(dx=>({x:dx,y:ground(terrain,fighter.x+dx,Math.max(0,fighter.y-48))-fighter.y}))
  .filter(point=>Math.abs(point.y)<=48);
 if(samples.length<3)return 0;
 const meanX=samples.reduce((sum,p)=>sum+p.x,0)/samples.length,meanY=samples.reduce((sum,p)=>sum+p.y,0)/samples.length;
 const numerator=samples.reduce((sum,p)=>sum+(p.x-meanX)*(p.y-meanY),0),denominator=samples.reduce((sum,p)=>sum+(p.x-meanX)**2,0);
 const slope=denominator?Math.atan(numerator/denominator)*180/Math.PI:0;
 return Math.round(clamp(-fighter.facing*slope,-MAX_AIM_SLOPE,MAX_AIM_SLOPE))||0;
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
 const weapon=WEAPONS.find(weapon=>weapon.id===fighter.equipment.weapon)!;
 const previous=fighter.aimSlope??0,next=terrainAimOffset(terrain,fighter);
 fighter.aimAngle=clampAimAngle(weapon,next,(fighter.aimAngle??45)+next-previous);fighter.aimSlope=next;
}
