import {fighterHitBounds} from './physics';

/**
 * Enfurecer and Gelo, after DDTank 4.1 (docs/consumables.md).
 *
 * Enfurecer (10018, AttackUpSpell → AddDander 100 on a 200 scale): +50 points on our 0–100 POW bar, at once.
 * It is not the +50% damage bonus and never changes the shot's force.
 *
 * Gelo (10015, FrostSpell → SetBall(1)): the shot becomes one ice ball (Radii 60, same flight as the plane's
 * Ball3, no crater, no damage). Every enemy within ICE_RADIUS of where it lands is frozen (IceFronzeEffect(2)):
 * their next 2 turns are skipped, they take no damage while frozen, and the first attack only breaks the ice.
 */
export const RAGE_CHARGE=50;
export const ICE_RADIUS=60;
/** Own turns a frozen fighter loses before the ice thaws by itself. */
export const ICE_SKIPPED_TURNS=2;
/** Value of `frozenTurns` right after freezing: each own turn start takes one; it thaws (and plays) at 0. */
export const ICE_FROZEN_TURNS=ICE_SKIPPED_TURNS+1;
export function isFrozen(f:{frozenTurns?:number;hp:number}){return f.hp>0&&(f.frozenTurns??0)>0;}
/** Enemies a landed ice ball freezes (DDTank FindHitByHitPiont: the body touches the ball's circle). Players use
 * the 30×30 box, monsters their circle; the world boss dragon never freezes. */
export function iceTargets<T extends {team:number;hp:number;x:number;y:number;boss?:string;monster?:string;hitRadius?:number;hitHeight?:number}>(players:readonly T[],shooterTeam:number,at:{x:number;y:number}):T[]{
 return players.filter(p=>{
  if(p.team===shooterTeam||p.hp<=0||p.boss)return false;
  if(p.monster){const r=p.hitRadius??24;return Math.hypot(p.x-at.x,p.y-(p.hitHeight??r*2)/2-at.y)<=ICE_RADIUS+r;}
  const b=fighterHitBounds(p),dx=Math.max(b.left-at.x,0,at.x-b.right),dy=Math.max(b.top-at.y,0,at.y-b.bottom);
  return Math.hypot(dx,dy)<=ICE_RADIUS;
 });
}
