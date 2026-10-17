import {DYE_SLOTS,normalizeVisibility,SLOTS} from '../shared/catalog';
import type {DyeId,DyeSlot,Equipment,EquipmentVisibility,Slot} from '../shared/catalog';
import type {Command} from '../shared/protocol';

export interface CustomizationPatch {
 items?:Partial<Record<Slot,string>>;
 dyes?:Partial<Record<DyeSlot,DyeId>>;
 visibility?:EquipmentVisibility;
}
type CustomizeCommand=Extract<Command,{type:'customize'}>;
export function appearanceKey(equipment:Equipment){
 return JSON.stringify([SLOTS.map(slot=>equipment[slot]),DYE_SLOTS.map(slot=>equipment.dyes?.[slot]??'original'),normalizeVisibility(equipment.visibility)]);
}

/** One transaction at a time. Later clicks merge into the latest desired appearance. */
export class CustomizationQueue {
 private desired:Equipment|null=null;
 private active:{requestId:string}|null=null;
 private sequence=0;
 constructor(private confirmed:()=>Equipment,private send:(command:CustomizeCommand)=>void,private publish:(equipment:Equipment|null,pending:boolean)=>void){}
 apply(patch:CustomizationPatch){
  const base=this.desired??this.confirmed();
  this.desired={...base,...patch.items,dyes:{...base.dyes,...patch.dyes},visibility:{...normalizeVisibility(base.visibility),...patch.visibility}};
  this.flush();
 }
 matches(requestId:string){return this.active?.requestId===requestId;}
 acknowledge(requestId:string){
  if(!this.matches(requestId))return false;
  this.active=null;this.flush();return true;
 }
 reject(requestId:string){
  if(!this.matches(requestId))return false;
  this.cancel();return true;
 }
 cancel(){this.active=null;this.desired=null;this.publish(null,false);}
 private flush(){
  if(this.active){this.publish(this.desired,true);return;}
  if(!this.desired||appearanceKey(this.desired)===appearanceKey(this.confirmed())){this.cancel();return;}
  const next=this.desired,requestId=`appearance-${++this.sequence}`;
  this.active={requestId};
  this.publish(next,true);
  this.send({type:'customize',requestId,selection:{items:Object.fromEntries(SLOTS.map(slot=>[slot,next[slot]])) as Record<Slot,string>,dyes:{...next.dyes},visibility:normalizeVisibility(next.visibility)}});
 }
}
