import type {Battle} from '../../shared/protocol';
import {walkStep,WALK_HEADROOM,WALK_STEP_Y,type WalkProbe} from '../../shared/physics';

/** Walk guides (docs/implementation-status.md "Caminhada"): off unless `?walk=1` or
 * `localStorage['brasa-debug-walk']='1'`. Draws, for the local fighter only and on this client's copy of the
 * terrain, the next DDTank step toward where it faces (the same `walkStep` the server runs): the feet, the next
 * x, the x−1 and x+1 columns tested, where the search down starts, the support found, the height difference
 * and why the step would be refused. Other fighters are never probed, so nothing about a hidden rival leaks. */
export const WALK_DEBUG=(()=>{
 try{return new URLSearchParams(location.search).get('walk')==='1'||localStorage.getItem('brasa-debug-walk')==='1';}catch{return false;}
})();

const REASONS:Record<NonNullable<WalkProbe['reject']>,string>={edge:'borda do mapa',wall:`parede > ${WALK_STEP_Y}px`,ceiling:'teto baixo',drop:'queda',void:'sem chão (vazio)'};

export function drawWalkDebug(c:CanvasRenderingContext2D,battle:Battle,terrain:Uint8Array,meId:string|undefined){
 const me=battle.players.find(f=>f.id===meId);if(!me||me.hidden||me.hp<=0||me.y>864)return;
 const probe=walkStep(terrain,me,me.facing);
 c.save();c.lineWidth=1;c.font='700 10px monospace';c.textBaseline='bottom';
 const {from,nextX,searchY}=probe;
 // Feet.
 c.fillStyle='#ffe600';c.fillRect(from.x-2,from.y-2,4,4);
 // x−1 and x+1 columns, from the search start down to the support (or 40 px when there is none).
 const bottom=probe.support??Math.min(searchY+40,864);
 c.fillStyle='#38b6ff';for(const dx of [-1,1])c.fillRect(nextX+dx,searchY,1,Math.max(1,bottom-searchY));
 // Search start and the room the body needs above the support.
 c.strokeStyle='#38b6ff';c.beginPath();c.moveTo(nextX-5,searchY+.5);c.lineTo(nextX+5,searchY+.5);c.stroke();
 if(probe.support!==null){c.strokeStyle='#ffffff55';c.setLineDash([2,2]);c.strokeRect(nextX-.5,probe.support-WALK_HEADROOM,1,WALK_HEADROOM-(probe.support-searchY));c.setLineDash([]);}
 if(probe.ceiling!==undefined){c.fillStyle='#ff3d6e';c.fillRect(nextX-3,probe.ceiling-1,6,2);}
 // Support found (green when the step is taken, red when refused).
 const color=probe.to?'#3dff8b':'#ff3d6e';
 if(probe.support!==null){c.fillStyle=color;c.fillRect(nextX-2,probe.support-2,5,5);}
 if(probe.fall&&probe.fall.y<864){c.strokeStyle='#ff9b2f';c.setLineDash([3,3]);c.beginPath();c.moveTo(nextX,from.y);c.lineTo(probe.fall.x,probe.fall.y);c.stroke();c.setLineDash([]);}
 const rise=probe.rise===null?'—':(probe.rise>0?'+':'')+probe.rise;
 const label=probe.to?`passo ok Δy ${rise}`:`recusado: ${REASONS[probe.reject!]} Δy ${rise}`;
 c.fillStyle='#000a';const w=c.measureText(label).width;c.fillRect(from.x-w/2-3,from.y+6,w+6,13);
 c.fillStyle=color;c.fillText(label,from.x-w/2,from.y+18);
 c.restore();
}
