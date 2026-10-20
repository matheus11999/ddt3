/** Force bar of the DDTank 4.1 EnergyView: holding the button adds 20 of the 2000 launch force
 * (1 point of the 0–100 bar) per update; at the top it falls back, and a bar that falls to zero
 * passes the turn. DDTank counts one update per stage frame; here the clock is explicit, so the
 * bar moves the same on any monitor (docs/ballistics.md). */
export const FORCE_BAR_STEP_MS=40;
export const FORCE_BAR_MAX=100;

/** Bar value after holding `elapsedMs`: 1→100 rising, then 99→0 falling (0 = the turn passes). */
export function forceBarValue(elapsedMs:number):{power:number;falling:boolean} {
 const steps=Math.max(0,Math.floor(elapsedMs/FORCE_BAR_STEP_MS));
 if(steps<FORCE_BAR_MAX)return {power:steps+1,falling:false};
 return {power:Math.max(0,2*FORCE_BAR_MAX-steps),falling:steps>FORCE_BAR_MAX};
}

/** A full hold, 1→100→0, after which the client passes the turn by itself. */
export const FORCE_BAR_CYCLE_MS=2*FORCE_BAR_MAX*FORCE_BAR_STEP_MS;
/** Longest a charge started before the turn clock ran out keeps the turn open (user request, 20/10/2026):
 * the full bar cycle plus 1 s for the network. Past it the server ends the turn even if still held. */
export const CHARGE_HOLD_MS=FORCE_BAR_CYCLE_MS+1000;

/** Whether the turn stays open past its deadline because the player was already charging the shot. */
export function chargeHoldsTurn(deadline:number,chargingSince:number|undefined,now:number){
 return chargingSince!==undefined&&chargingSince<=deadline&&now<chargingSince+CHARGE_HOLD_MS;
}
