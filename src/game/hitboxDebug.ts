import type {Battle,Shot} from '../../shared/protocol';
import {fighterHitBounds} from '../../shared/physics';
import {aimPivot} from './aimIndicator';
import {flightTime,projectileFrame} from './shotPlayback';

/** Temporary hit box guides (docs/hitbox-aim.md): off unless `localStorage['brasa-debug-hitbox']='1'` or
 * `?hitbox=1`. Draws, from the server's positions and the shared contract only: feet, box origin, the box,
 * the aim pivot of the local fighter, each projectile's centre and its first contact. A fighter the server
 * hides from this client arrives without a real position and is skipped, so nothing leaks. */
export const HITBOX_DEBUG=(()=>{
 try{return new URLSearchParams(location.search).get('hitbox')==='1'||localStorage.getItem('brasa-debug-hitbox')==='1';}catch{return false;}
})();

export function drawHitboxDebug(c:CanvasRenderingContext2D,battle:Battle,shot:Shot|null,elapsed:number,meId:string|undefined){
 c.save();c.lineWidth=1.5;c.font='700 10px monospace';c.textBaseline='bottom';
 for(const f of battle.players){
  if(f.hidden||f.hp<=0)continue;
  if(f.hitRadius!==undefined){
   // Monsters and bosses keep their own circle.
   c.strokeStyle='#ff6bd5';c.beginPath();c.arc(f.x,f.y-(f.hitHeight??31),f.hitRadius,0,Math.PI*2);c.stroke();continue;
  }
  const box=fighterHitBounds(f);
  c.fillStyle='#00ffd522';c.fillRect(box.left,box.top,box.right-box.left,box.bottom-box.top);
  c.strokeStyle='#00ffd5';c.strokeRect(box.left,box.top,box.right-box.left,box.bottom-box.top);
  // Feet (Brasa support point) and the box origin O (DDTank logical origin).
  c.fillStyle='#ffe600';c.fillRect(f.x-2,f.y-2,4,4);c.fillStyle='#ff3d6e';c.fillRect(box.originX-2,box.originY-2,4,4);
  c.fillStyle='#ffffff';c.fillText('30×30',box.left,box.top-2);
  if(f.id===meId){const pivot=aimPivot(f.x,f.y,f.facing);c.strokeStyle='#ffffff';c.beginPath();c.arc(pivot.x,pivot.y,4,0,Math.PI*2);c.moveTo(pivot.x-7,pivot.y);c.lineTo(pivot.x+7,pivot.y);c.moveTo(pivot.x,pivot.y-7);c.lineTo(pivot.x,pivot.y+7);c.stroke();}
 }
 if(shot&&!shot.hidden)for(const p of shot.projectiles){
  const age=elapsed-p.delay;if(age<0||p.monster)continue;
  const center=p.points[Math.floor(projectileFrame(p,Math.min(age,flightTime(p))))];
  if(center){c.strokeStyle='#7df9ff';c.beginPath();c.arc(center[0],center[1],3,0,Math.PI*2);c.stroke();}
  if(age>=flightTime(p)){const end=p.points.at(-1);c.strokeStyle='#ff9b2f';c.beginPath();c.moveTo(p.impact.x-5,p.impact.y-5);c.lineTo(p.impact.x+5,p.impact.y+5);c.moveTo(p.impact.x+5,p.impact.y-5);c.lineTo(p.impact.x-5,p.impact.y+5);c.stroke();if(end){c.setLineDash([2,2]);c.beginPath();c.moveTo(end[0],end[1]);c.lineTo(p.impact.x,p.impact.y);c.stroke();c.setLineDash([]);}}
 }
 c.restore();
}
