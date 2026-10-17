import type {Fighter} from '../../shared/protocol';

/** Compact world-space HP plate; turn markers remain readable over bright maps. */
export function drawFighterIndicators(c:CanvasRenderingContext2D,fighter:Fighter,x:number,y:number,ally:boolean,active:boolean,time:number,lift=0){
 const hp=Math.max(0,Math.min(1,fighter.hp/fighter.maxHp)),width=86,top=y-117-lift;
 c.save();c.textAlign='center';c.font='800 12px "Nunito",sans-serif';c.lineWidth=3;c.strokeStyle='#10233ce6';c.fillStyle=active?'#ffdf86':'#f3f7ff';
 const name=plateName(fighter);c.strokeText(name,x,top-7);c.fillText(name,x,top-7);
 c.shadowColor='#07162a';c.shadowBlur=3;c.fillStyle='#10243eed';c.beginPath();c.roundRect(x-width/2-2,top-2,width+4,14,6);c.fill();
 c.shadowBlur=0;c.strokeStyle=active?'#f4d68a':'#a9c6d08c';c.lineWidth=1;c.stroke();
 c.fillStyle='#172330';c.beginPath();c.roundRect(x-width/2,top,width,10,4);c.fill();
 if(hp>0){const fill=c.createLinearGradient(0,top,0,top+10);fill.addColorStop(0,ally?'#a3f0d2':'#ffb9b1');fill.addColorStop(.45,ally?'#32bd93':'#f65e72');fill.addColorStop(1,ally?'#188875':'#b83055');c.fillStyle=fill;c.beginPath();c.roundRect(x-width/2,top,Math.max(2,width*hp),10,Math.min(4,width*hp/2));c.fill();}
 c.font='900 9px "Nunito",sans-serif';c.lineWidth=2;c.strokeStyle='#10233d';c.fillStyle='#fff';const value=String(Math.max(0,Math.ceil(fighter.hp)));c.strokeText(value,x,top+8);c.fillText(value,x,top+8);
 if(active){
  const bounce=Math.sin(time/230)*2,markY=top-28+bounce;c.translate(x,markY);c.shadowColor='#ffb72e';c.shadowBlur=9;
  const gold=c.createLinearGradient(0,-15,0,5);gold.addColorStop(0,'#fff5c2');gold.addColorStop(1,'#f4aa35');c.fillStyle=gold;c.strokeStyle='#79501b';c.lineWidth=2;
  c.beginPath();c.moveTo(-10,-12);c.lineTo(0,-7);c.lineTo(10,-12);c.lineTo(10,-5);c.lineTo(0,3);c.lineTo(-10,-5);c.closePath();c.fill();c.stroke();
 }
 c.restore();
}

export type FighterPlate={fighter:Fighter;x:number;y:number;ally:boolean;active:boolean};

const PLATE_LIFT=30,PLATE_GAP=6;
const plateName=(fighter:Fighter)=>fighter.name.length>18?fighter.name.slice(0,17)+'…':fighter.name;

/** Raises a plate one row for every neighbour it would touch, so names and HP bars of
 * fighters standing side by side never overlap. Returns the lift in pixels per plate. */
export function plateLifts(plates:{x:number;y:number;width:number}[]){
 const placed:{left:number;right:number;top:number}[]=[],lifts=new Array<number>(plates.length).fill(0);
 plates.map((plate,index)=>({plate,index})).sort((a,b)=>a.plate.x-b.plate.x).forEach(({plate,index})=>{
  const left=plate.x-plate.width/2-PLATE_GAP/2,right=plate.x+plate.width/2+PLATE_GAP/2;
  let lift=0;
  while(placed.some(other=>other.left<right&&left<other.right&&Math.abs(other.top-(plate.y-lift))<PLATE_LIFT))lift+=PLATE_LIFT;
  placed.push({left,right,top:plate.y-lift});lifts[index]=lift;
 });
 return lifts;
}

export function drawFighterPlates(c:CanvasRenderingContext2D,plates:FighterPlate[],time:number){
 c.save();c.font='800 12px "Nunito",sans-serif';
 const lifts=plateLifts(plates.map(plate=>({x:plate.x,y:plate.y,width:Math.max(90,c.measureText(plateName(plate.fighter)).width+8)})));
 c.restore();
 plates.forEach((plate,index)=>drawFighterIndicators(c,plate.fighter,plate.x,plate.y,plate.ally,plate.active,time,lifts[index]));
}
