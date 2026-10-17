import {normalizeVisibility,SLOTS} from '../shared/catalog';
import type {Equipment,EquipmentVisibility,Slot} from '../shared/catalog';
import type {Command} from '../shared/protocol';

export interface CustomizationPatch {
 items?:Partial<Record<Slot,string>>;
 /** The owned copy for a slot in `items` (omit for the first copy). */
 copies?:Partial<Record<Slot,string>>;
 visibility?:EquipmentVisibility;
}
type CustomizeCommand=Extract<Command,{type:'customize'}>;
export function appearanceKey(equipment:Equipment){
 return JSON.stringify([SLOTS.map(slot=>equipment[slot]),SLOTS.map(slot=>equipment.copies?.[slot]??''),normalizeVisibility(equipment.visibility)]);
}

/** One transaction at a time. Later clicks merge into the latest desired appearance. */
export class CustomizationQueue {
 private desired:Equipment|null=null;
 private active:{requestId:string}|null=null;
 private sequence=0;
 constructor(private confirmed:()=>Equipment,private send:(command:CustomizeCommand)=>void,private publish:(equipment:Equipment|null,pending:boolean)=>void){}
 apply(patch:CustomizationPatch){
  const base=this.desired??this.confirmed();
  // Changing a slot drops its old copy unless the patch names the new one.
  const copies={...base.copies};for(const slot of Object.keys(patch.items??{}) as Slot[]){delete copies[slot];const copy=patch.copies?.[slot];if(copy)copies[slot]=copy;}
  this.desired={...base,...patch.items,copies,visibility:{...normalizeVisibility(base.visibility),...patch.visibility}};
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
  this.send({type:'customize',requestId,selection:{items:Object.fromEntries(SLOTS.map(slot=>[slot,next[slot]])) as Record<Slot,string>,copies:{...next.copies},visibility:normalizeVisibility(next.visibility)}});
 }
}
