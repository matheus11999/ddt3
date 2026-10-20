import {MONSTERS} from '../../shared/expeditions';
import {INSTANCE_INTRO_MS,MONSTER_BITE_WINDUP_MS,monsterStep,QUEEN_DRAW_MS} from '../../shared/instanceTurn';
import {ground,WORLD} from '../../shared/physics';
import type {Battle,Fighter} from '../../shared/protocol';
import {freeAll} from './spriteCache';

/**
 * Expedition monsters in battle. Each is a painted 4-frame strip (public/assets/expeditions/…, cut from a
 * Codex 2x2 sheet by scripts/cut-monster-sheet.mjs): melee ants = walk A, walk B, wind-up, bite;
 * the queen = idle, draw, release, hurt. Motion (bob, lunge, flinch, death) is drawn in code.
 * Positions follow the server: the walk-in at a stage's start and the shared monster turn.
 */
const images=new Map<string,HTMLImageElement>();
function sheet(src:string){let image=images.get(src);if(!image){image=new Image();image.decoding='async';image.src=src;images.set(src,image);}return image;}
/** Lets the monster sheets go after an expedition (they come back with the next one). */
export function releaseMonsters(){freeAll(images);}
export function preloadMonsters(){const list:HTMLImageElement[]=[];for(const def of Object.values(MONSTERS)){list.push(sheet(def.sprite.src));if(def.sprite.walk)list.push(sheet(def.sprite.walk.src));}list.push(sheet(ARROW_SRC));return list;}
export const ARROW_SRC='/assets/expeditions/anthill/arrow.png';

export const MONSTER_DEATH_MS=900;
/** Legs follow the ground covered (no sliding feet): one walk cycle every this many px when the kind has no `walk.cycle`. */
const WALK_CYCLE_PX=56;
export interface MonsterView {x:number;y:number;facing:1|-1;visible:boolean;alpha:number;frame:number;bob:number;lunge:number;squash:number;moving:boolean;
 /** While walking: where in the walk cycle it is (0-1), stepped by the distance covered. */
 step:number;}

/** Where and how a monster is drawn right now (server time), from the snapshot and the monster turn's timeline. */
export function monsterView(b:Battle,f:Fighter,terrain:Uint8Array,now:number):MonsterView{
 const def=MONSTERS[f.monster!],melee=def.behavior==='melee',turn=b.instance?.monsterTurn,width=terrain.length/WORLD.rows*WORLD.cell;
 let x=f.x,y=f.y,facing=f.facing,moving=false,frame=0,lunge=0,squash=0,alpha=1,visible=true,walked=0;
 // Walk-in (first stage only): every monster enters from its own side of the map while the stage opens.
 const intro=b.instance?.stage===1?b.instance.introUntil-now:0;
 if(intro>0&&b.instance?.boss!==f.id){
  const k=Math.min(1,Math.max(0,1-intro/(INSTANCE_INTRO_MS*.9))),from=f.x<width/2?-70:width+70,ease=1-(1-k)**2;
  x=from+(f.x-from)*ease;const g=ground(terrain,x,Math.max(0,f.y-60));y=g<=WORLD.height?g:f.y;moving=k<1;facing=from<f.x?1:-1;walked=Math.abs(x-from);
 }
 const move=turn?.moves.find(m=>m.id===f.id);
 if(move&&turn){const step=monsterStep(move,now-turn.startedAt);x=step.x;y=step.y;moving=step.moving;facing=move.facing;walked=Math.abs(x-move.from[0]);}
 const cycle=def.sprite.walk?.cycle??WALK_CYCLE_PX,step=moving?(walked/cycle+(f.slot%4)*.25)%1:0;
 if(melee&&moving)frame=Math.floor(step*2)%2;
 const bite=turn?.bites.find(entry=>entry.id===f.id);
 if(bite){const before=bite.at-now;if(before>0&&before<MONSTER_BITE_WINDUP_MS){frame=2;squash=-.06;lunge=-6*(1-before/MONSTER_BITE_WINDUP_MS);}else if(before<=0&&before>-260){frame=3;lunge=14*Math.sin(Math.PI*Math.min(1,-before/260));squash=.05;}}
 if(!melee){
  frame=0;const arrow=turn?.arrowAt;
  if(arrow!==undefined){const before=arrow-now;if(before>0&&before<QUEEN_DRAW_MS-150)frame=1;else if(before<=0&&before>-420)frame=2;}
 }
 const summon=turn?.summons.find(s=>s.id===f.id);
 if(summon){const age=now-summon.at;if(age<0)visible=false;else if(age<500){alpha=age/500;squash=-.2*(1-age/500);}}
 if(f.hp<=0&&!summon)visible=true;
 // A light bob, twice per cycle (each step), on top of the painted frames; a slow breath when standing.
 return {x,y,facing,visible,alpha,frame,bob:moving?Math.abs(Math.sin(step*Math.PI*2))*-(def.sprite.walk?1.2:2.4):Math.sin(now/520+f.slot)*1.2,lunge,squash,moving,step};
}

/** Draws one monster at its view; `hurtAge` flashes and shakes it, `deathAge` flips it over and fades it out. */
export function drawMonster(c:CanvasRenderingContext2D,f:Fighter,view:MonsterView,slope:number,hurtAge=-1,deathAge=-1){
 if(!view.visible)return;
 const def=MONSTERS[f.monster!],queen=def.behavior==='queen',walkSheet=def.sprite.walk?sheet(def.sprite.walk.src):undefined;
 // Walking ants use their 4-frame walk cycle when it is loaded (frames 0-1 of the main strip otherwise).
 const walking=view.moving&&deathAge<0&&!!walkSheet?.complete&&!!walkSheet.naturalWidth,image=walking?walkSheet!:sheet(def.sprite.src);
 if(!image.complete||!image.naturalWidth){fallbackBody(c,view,def.sprite.height);return;}
 const fw=image.naturalWidth/4,fh=image.naturalHeight,h=def.sprite.height,w=h*fw/fh;
 let frame=walking?Math.floor(view.step*4)%4:view.frame,alpha=view.alpha,rotate=slope,dy=0,shake=0;
 if(hurtAge>=0&&hurtAge<380){shake=Math.sin(hurtAge/18)*4*(1-hurtAge/380);if(queen&&hurtAge<300)frame=3;}
 if(deathAge>=0){const k=Math.min(1,deathAge/MONSTER_DEATH_MS);if(queen){dy=k*30;alpha*=1-k;frame=3;}else{rotate+=Math.PI*Math.min(1,k*2.2);dy=-28*Math.sin(Math.PI*Math.min(1,k*1.6));alpha*=1-Math.max(0,k-.35)/.65;}}
 if(alpha<=0)return;
 const flip=view.facing!==def.sprite.faces?-1:1;
 c.save();c.globalAlpha*=alpha;c.translate(view.x+shake+view.lunge*view.facing,view.y+dy+view.bob);c.rotate(rotate);
 if(deathAge>=0&&!queen)c.translate(0,-h*.45);
 c.scale(flip*(1+view.squash*.5),1-view.squash);
 if(hurtAge>=0&&hurtAge<160)c.filter='brightness(1.9) saturate(.6)';
 c.drawImage(image,frame*fw,0,fw,fh,-w/2,-h*def.sprite.feet+(deathAge>=0&&!queen?h*.45:0),w,h);
 c.restore();
}

function fallbackBody(c:CanvasRenderingContext2D,view:MonsterView,height:number){
 c.save();c.globalAlpha*=view.alpha;c.fillStyle='#b8321f';c.strokeStyle='#3b0d06';c.lineWidth=3;
 c.beginPath();c.ellipse(view.x,view.y-height*.35+view.bob,height*.5,height*.32,0,0,Math.PI*2);c.fill();c.stroke();c.restore();
}

/** Top of the slim HP bar, just under the creature's feet. */
export function monsterPlateY(_f:Fighter,feetY:number){return feetY+10;}

/** The queen's arrow along its path, nose first. */
export function drawArrow(c:CanvasRenderingContext2D,points:number[][],index:number){
 const at=points[Math.min(points.length-1,Math.floor(index))],next=points[Math.min(points.length-1,Math.floor(index)+1)]??at,prev=points[Math.max(0,Math.floor(index)-1)]??at;
 if(!at)return;const angle=Math.atan2(next[1]-prev[1],next[0]-prev[0]),image=sheet(ARROW_SRC);
 c.save();c.translate(at[0],at[1]);c.rotate(angle);
 if(image.complete&&image.naturalWidth){const w=78,h=w*image.naturalHeight/image.naturalWidth;c.drawImage(image,-w*.7,-h/2,w,h);}
 else{c.strokeStyle='#7a4a1c';c.lineWidth=3;c.beginPath();c.moveTo(-40,0);c.lineTo(10,0);c.stroke();c.fillStyle='#ffb347';c.beginPath();c.moveTo(18,0);c.lineTo(6,-6);c.lineTo(6,6);c.fill();}
 c.restore();
}
/** A small amber burst where the arrow lands. */
export function drawArrowImpact(c:CanvasRenderingContext2D,x:number,y:number,age:number){
 if(age<0||age>420)return;const k=age/420;
 c.save();c.globalAlpha=1-k;c.strokeStyle='#ffcf6b';c.lineWidth=3*(1-k)+1;
 for(let n=0;n<7;n++){const a=n/7*Math.PI*2,r0=6+18*k,r1=14+30*k;c.beginPath();c.moveTo(x+Math.cos(a)*r0,y+Math.sin(a)*r0);c.lineTo(x+Math.cos(a)*r1,y+Math.sin(a)*r1);c.stroke();}
 c.restore();
}
