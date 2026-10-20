import art from './aimArt.json';
import {SHOT_ORIGIN} from '../../shared/physics';

/** Aim next to the fighter, after DDTank's TakeAimAsset (docs/hitbox-aim.md): the painted red arc behind the
 * avatar ('back'), mirrored by the facing and turned with the ground tilt, and a solid, slightly transparent yellow
 * direction line in front of it ('front'; the dotted one was rejected on 20/10/2026), pivoting on the real shot origin so it shows the true initial direction.
 * Unlike the original, the arc shows only the angles the fighter can use (user request, 20/10/2026): it is cut
 * to the weapon's limits, the same ones the controls and the server clamp to. The degree plate is Brasa's own. */
const draw=art.draw,scale=draw.scale;
const images=new Map<string,HTMLImageElement>();
function request(src:string){
 let img=images.get(src);if(!img&&typeof Image!=='undefined'){img=new Image();img.decoding='async';img.src=src;images.set(src,img);}
 return img;
}
function image(src:string){const img=request(src);return img?.complete&&img.naturalWidth?img:undefined;}
/** The aim's paintings, for the battle preloader. */
export function aimImages(){return [art.arc.file].map(request).filter((img):img is HTMLImageElement=>!!img);}

/** Pivot of the direction line: the shot origin, where the server launches the projectile. */
export function aimPivot(x:number,y:number,facing:1|-1){return {x:x+facing*SHOT_ORIGIN.forward,y:y-SHOT_ORIGIN.up};}

/** `angle` is the world elevation of the shot (slope already included), as the server launches it;
 * `tilt` is the drawn body's rotation in screen radians and only turns the painted arc. */
export function drawAimIndicator(c:CanvasRenderingContext2D,x:number,y:number,facing:1|-1,angle:number,tilt:number,changedAge:number,limits:{minAngle:number;maxAngle:number},layer:'back'|'front'='back'){
 const pivot=aimPivot(x,y,facing),changed=changedAge>=0&&changedAge<1500;
 c.save();
 if(layer==='back'){
  const arc=image(art.arc.file);
  if(arc){
   // Body frame: +x forward, rotated by the tilt. The arc is painted facing left and its rim centre sits
   // `arcCenter` from the pivot (+x toward the back of the body, original units).
   const k=draw.arcRimRadius*scale/art.arc.rimRadius,reach=(art.arc.size[0]+art.arc.size[1])*k;
   // Wedge of the usable world elevations around the pivot.
   const toCanvas=(degree:number)=>facing>0?-degree*Math.PI/180:Math.PI+degree*Math.PI/180;
   const [from,to]=facing>0?[toCanvas(limits.maxAngle),toCanvas(limits.minAngle)]:[toCanvas(limits.minAngle),toCanvas(limits.maxAngle)];
   c.beginPath();c.moveTo(pivot.x,pivot.y);c.arc(pivot.x,pivot.y,reach,from,to);c.closePath();c.clip();
   c.translate(pivot.x,pivot.y);c.rotate(tilt);c.scale(-facing,1);
   c.translate(draw.arcCenter[0]*scale,draw.arcCenter[1]*scale);c.globalAlpha*=draw.arcAlpha;
   c.drawImage(arc,-art.arc.pivot[0]*k,-art.arc.pivot[1]*k,art.arc.size[0]*k,art.arc.size[1]*k);
  }
  c.restore();return;
 }
 // Same span as the original ten dots, as one line from pale to gold yellow.
 const rad=angle*Math.PI/180,ux=facing*Math.cos(rad),uy=-Math.sin(rad),line=draw.line,base=c.globalAlpha;
 const ax=pivot.x+ux*line.from*scale,ay=pivot.y+uy*line.from*scale,bx=pivot.x+ux*line.to*scale,by=pivot.y+uy*line.to*scale;
 const fill=c.createLinearGradient(ax,ay,bx,by);fill.addColorStop(0,'#fff6a8');fill.addColorStop(1,'#ffd21f');
 c.lineCap='round';c.globalAlpha=base*line.alpha;
 c.beginPath();c.moveTo(ax,ay);c.lineTo(bx,by);c.strokeStyle='#5a3a0099';c.lineWidth=line.width+2;c.stroke();
 c.strokeStyle=fill;c.lineWidth=line.width;c.stroke();
 c.globalAlpha=base;
 // Readout plate on the ground past the arc, on the facing side.
 const label=Math.round(angle)+'°',labelX=x+facing*draw.plate.forward,labelY=y-draw.plate.up;
 c.textAlign='center';c.textBaseline='middle';c.font='900 17px "Nunito","Trebuchet MS",sans-serif';const w=c.measureText(label).width+14;
 c.beginPath();c.roundRect(labelX-w/2,labelY-11,w,22,8);c.fillStyle='#071629d9';c.fill();c.strokeStyle=changed?'#fff0a8':'#d8ab55';c.lineWidth=1.5;c.stroke();
 c.lineWidth=3;c.strokeStyle='#3a1a06';c.fillStyle=changed?'#fff7b0':'#ffe35e';c.strokeText(label,labelX,labelY+1);c.fillText(label,labelX,labelY+1);
 c.restore();
}
