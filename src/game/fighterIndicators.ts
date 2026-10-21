import type {Fighter} from '../../shared/protocol';
import {stamp} from './lobbyWorld';

/** Compact world-space HP plate; turn markers remain readable over bright maps. */
export function drawFighterIndicators(c:CanvasRenderingContext2D,fighter:Fighter,x:number,y:number,ally:boolean,active:boolean,time:number,lift=0){
 const top=y-117-lift,name=plateName(fighter),guild=fighter.guild&&!fighter.monster?plateName({...fighter,name:fighter.guild}):'',hp=Math.max(0,Math.ceil(fighter.hp));
 // Painted once per name, guild, HP and turn into a small canvas (text outlines and the blurred rim every frame were most of a plate's cost).
 stamp(c,`fighter|${name}|${guild}|${hp}|${fighter.maxHp}|${ally}|${active}`,x,top,[-90,-34,180,50],g=>paintPlate(g,name,guild,hp/fighter.maxHp,hp,ally,active));
 c.save();
 if(active){
  const bounce=Math.sin(time/230)*2,markY=top-(guild?39:28)+bounce;c.translate(x,markY);c.shadowColor='#ffb72e';c.shadowBlur=9;
  const gold=c.createLinearGradient(0,-15,0,5);gold.addColorStop(0,'#fff5c2');gold.addColorStop(1,'#f4aa35');c.fillStyle=gold;c.strokeStyle='#79501b';c.lineWidth=2;
  c.beginPath();c.moveTo(-10,-12);c.lineTo(0,-7);c.lineTo(10,-12);c.lineTo(10,-5);c.lineTo(0,3);c.lineTo(-10,-5);c.closePath();c.fill();c.stroke();
 }
 c.restore();
}

/** A fighter's name, guild and HP bar, with the bar's top at (0,0). */
function paintPlate(c:CanvasRenderingContext2D,name:string,guild:string,share:number,value:number,ally:boolean,active:boolean){
 const hp=Math.max(0,Math.min(1,share)),width=86,x=0,top=0;
 c.save();c.textAlign='center';c.font='800 12px "Nunito",sans-serif';c.lineWidth=3;c.strokeStyle='#10233ce6';c.fillStyle=active?'#ffdf86':'#f3f7ff';
 // The guild goes right under the name, as on the room cards; the name rises one line to make room.
 const nameY=guild?top-18:top-7;c.strokeText(name,x,nameY);c.fillText(name,x,nameY);
 if(guild){c.font='800 10px "Nunito",sans-serif';c.lineWidth=3;c.fillStyle='#e0b8ff';c.strokeText(guild,x,top-5);c.fillText(guild,x,top-5);}
 c.shadowColor='#07162a';c.shadowBlur=3;c.fillStyle='#10243eed';c.beginPath();c.roundRect(x-width/2-2,top-2,width+4,14,6);c.fill();
 c.shadowBlur=0;c.strokeStyle=active?'#f4d68a':'#a9c6d08c';c.lineWidth=1;c.stroke();
 c.fillStyle='#172330';c.beginPath();c.roundRect(x-width/2,top,width,10,4);c.fill();
 if(hp>0){const fill=c.createLinearGradient(0,top,0,top+10);fill.addColorStop(0,ally?'#a3f0d2':'#ffb9b1');fill.addColorStop(.45,ally?'#32bd93':'#f65e72');fill.addColorStop(1,ally?'#188875':'#b83055');c.fillStyle=fill;c.beginPath();c.roundRect(x-width/2,top,Math.max(2,width*hp),10,Math.min(4,width*hp/2));c.fill();}
 c.font='900 9px "Nunito",sans-serif';c.lineWidth=2;c.strokeStyle='#10233d';c.fillStyle='#fff';const text=String(value);c.strokeText(text,x,top+8);c.fillText(text,x,top+8);
 c.restore();
}

/** `slim`: a monster's nameless bar (`y` is its top, just under the feet) instead of the name plate. */
export type FighterPlate={fighter:Fighter;x:number;y:number;ally:boolean;active:boolean;slim?:boolean};

const PLATE_LIFT=30,PLATE_GAP=6;
const plateName=(fighter:Pick<Fighter,'name'>)=>fighter.name.length>18?fighter.name.slice(0,17)+'…':fighter.name;

/** Raises a plate one row for every neighbour it would touch, so names and HP bars of
 * fighters standing side by side never overlap. Returns the lift in pixels per plate. */
export function plateLifts(plates:{x:number;y:number;width:number}[],row=PLATE_LIFT){
 const placed:{left:number;right:number;top:number}[]=[],lifts=new Array<number>(plates.length).fill(0);
 plates.map((plate,index)=>({plate,index})).sort((a,b)=>a.plate.x-b.plate.x).forEach(({plate,index})=>{
  const left=plate.x-plate.width/2-PLATE_GAP/2,right=plate.x+plate.width/2+PLATE_GAP/2;
  let lift=0;
  while(placed.some(other=>other.left<right&&left<other.right&&Math.abs(other.top-(plate.y-lift))<row))lift+=row;
  placed.push({left,right,top:plate.y-lift});lifts[index]=lift;
 });
 return lifts;
}

export function drawFighterPlates(c:CanvasRenderingContext2D,plates:FighterPlate[],time:number){
 const people=plates.filter(plate=>!plate.slim),monsters=plates.filter(plate=>plate.slim);
 c.save();c.font='800 12px "Nunito",sans-serif';
 const lifts=plateLifts(people.map(plate=>({x:plate.x,y:plate.y,width:Math.max(90,c.measureText(plateName(plate.fighter)).width+8)})));
 c.restore();
 // Monsters crowd their prey, so theirs are slim bars with no name under their feet (clear of the adventurers' plates),
 // pushed down a row when two touch.
 const monsterRows=plateLifts(monsters.map(plate=>({x:plate.x,y:-plate.y,width:monsterBarWidth(plate.fighter)})),MONSTER_PLATE_LIFT);
 monsters.forEach((plate,index)=>drawMonsterBar(c,plate.fighter,plate.x,plate.y+monsterRows[index]));
 people.forEach((plate,index)=>drawFighterIndicators(c,plate.fighter,plate.x,plate.y,plate.ally,plate.active,time,lifts[index]));
}

const MONSTER_PLATE_LIFT=11;
const monsterBarWidth=(fighter:Fighter)=>Math.round(Math.min(74,Math.max(46,(fighter.hitRadius??40)*1.25)));
/** Slim HP bar over a monster's head (y = top of the bar). */
function drawMonsterBar(c:CanvasRenderingContext2D,fighter:Fighter,x:number,y:number){
 const hp=Math.max(0,Math.min(1,fighter.hp/fighter.maxHp)),width=monsterBarWidth(fighter),left=x-width/2;
 c.save();c.shadowColor='#1a0702';c.shadowBlur=3;c.fillStyle='#2a0d05ee';c.beginPath();c.roundRect(left-2,y-2,width+4,10,5);c.fill();
 c.shadowBlur=0;c.fillStyle='#3a1a12';c.beginPath();c.roundRect(left,y,width,6,3);c.fill();
 if(hp>0){const fill=c.createLinearGradient(0,y,0,y+6);fill.addColorStop(0,'#ffb9a8');fill.addColorStop(.5,'#f2503f');fill.addColorStop(1,'#a8241c');c.fillStyle=fill;c.beginPath();c.roundRect(left,y,Math.max(2,width*hp),6,Math.min(3,width*hp/2));c.fill();}
 c.restore();
}
