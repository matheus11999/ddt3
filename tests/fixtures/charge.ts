import type {Game} from '../../server/game';
import {FORCE_BAR_STEP_MS} from '../../shared/forceBar';

/** How long the bar is held to show `power` on its way up (shared/forceBar.ts forceBarValue). */
export const holdFor=(power:number)=>(Math.round(power)-1)*FORCE_BAR_STEP_MS+FORCE_BAR_STEP_MS/2;

/**
 * A release as the HUD sends it: the charge starts with an `aim` (the server's clock times the hold, A03) and the
 * hold that shows `power` is taken as already spent, so tests do not wait seconds per shot.
 */
export async function chargedFire(game:Game,id:string,fire:{angle:number;power:number}){
 await game.command(id,{type:'aim',angle:fire.angle,power:1,charging:true});
 for(const m of (game as unknown as {matches:Map<string,{state:{turnId:string};chargingSince?:number}>}).matches.values())
  if(m.state.turnId===id&&m.chargingSince!==undefined)m.chargingSince-=holdFor(fire.power);
 return game.command(id,{type:'fire',...fire});
}
