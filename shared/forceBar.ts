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
