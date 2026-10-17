import {normalizeAbilityLoadout} from '../shared/abilities';
import type {AbilityLoadout} from '../shared/abilities';
import type {Command} from '../shared/protocol';

type LoadoutCommand=Extract<Command,{type:'ability-loadout'}>;
const equal=(a:AbilityLoadout,b:AbilityLoadout)=>a.every((id,index)=>id===b[index]);

/** Keep the final preparation choice, even if the room menu unmounts during a save. */
export class AbilityLoadoutQueue {
 private desired:AbilityLoadout|null=null;
 private active:string|null=null;
 private sequence=0;
 constructor(private confirmed:()=>AbilityLoadout,private send:(command:LoadoutCommand)=>void,private publish:(draft:AbilityLoadout|null,pending:boolean)=>void){}
 apply(slots:AbilityLoadout){this.desired=normalizeAbilityLoadout(slots);this.flush();}
 matches(requestId:string){return this.active===requestId;}
 acknowledge(requestId:string){if(!this.matches(requestId))return false;this.active=null;this.flush();return true;}
 reject(requestId:string){if(!this.matches(requestId))return false;this.cancel();return true;}
 cancel(){this.active=null;this.desired=null;this.publish(null,false);}
 private flush(){
  if(this.active){this.publish(this.desired,true);return;}
  if(!this.desired||equal(this.desired,this.confirmed())){this.cancel();return;}
  const requestId=`loadout-${++this.sequence}`,slots=[...this.desired] as AbilityLoadout;
  this.active=requestId;this.publish(slots,true);this.send({type:'ability-loadout',slots,requestId});
 }
}
