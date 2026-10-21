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

/** Where the painted fill sits after holding `elapsedMs`, between whole points: the same path as
 * `forceBarValue`, but continuous so the bar glides every frame instead of jumping 25 times a second.
 * Only for drawing: the shot always uses the whole `forceBarValue` shown in the readout. */
export function forceBarFill(elapsedMs:number){
 const steps=Math.max(0,elapsedMs/FORCE_BAR_STEP_MS);
 // Rises to 100, rests there for the two updates the whole value stays at 100, then falls.
 if(steps<FORCE_BAR_MAX-1)return steps+1;
 if(steps<FORCE_BAR_MAX+1)return FORCE_BAR_MAX;
 return Math.max(0,2*FORCE_BAR_MAX-steps);
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

/** How far the server's clock may disagree with the client's bar (A03, auditoria 21/10/2026). The charge start and the
 * release travel the same socket and are timed when they arrive, so only the difference of their delays matters: the
 * release may count up to FORCE_EARLY_MS less hold than the bar showed (the start came in late) or up to FORCE_LATE_MS
 * more (the release came in late). Anything beyond is a shot the bar never showed. */
export const FORCE_EARLY_MS=600;
export const FORCE_LATE_MS=2000;

/** The force a release sends: exactly where the painted fill stands (forceBarFill), to the hundredth, so the shot is
 * the bar the player saw (pedido do matheus, 21/10/2026: no snap back to the whole number). */
export const releaseForce=(elapsedMs:number)=>Math.max(1,Math.round(forceBarFill(elapsedMs)*100)/100);

/** Whether a release of `power` (forceBarFill, to the hundredth) is one the bar shows at some moment within the
 * tolerance around `heldMs`, the hold measured by the server between the charge start and the release. */
export function forceMatchesHold(power:number,heldMs:number,early=FORCE_EARLY_MS,late=FORCE_LATE_MS){
 if(!Number.isFinite(power)||power<1||power>FORCE_BAR_MAX||Math.abs(power*100-Math.round(power*100))>1e-6||!Number.isFinite(heldMs)||heldMs<0)return false;
 // The holds whose fill is `power`: once rising and once falling, and the top rests two updates at 100.
 const step=FORCE_BAR_STEP_MS,holds:[number,number][]=[[(power-1)*step,(power-1)*step],[(2*FORCE_BAR_MAX-power)*step,(2*FORCE_BAR_MAX-power)*step]];
 if(power>=FORCE_BAR_MAX-.01)holds.push([(FORCE_BAR_MAX-1)*step,(FORCE_BAR_MAX+1)*step]);
 // A fill at 1 is also the moment the falling bar is about to pass the turn (its last hundredth).
 const slack=step/100;
 return holds.some(([from,to])=>heldMs>=from-slack-early&&heldMs<=to+slack+late);
}
