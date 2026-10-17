/** A fallen fighter is replaced on the field by a tombstone (user request, 17/10/2026):
 * no avatar, HP plate or name, it simply stays where the fighter fell until the end.
 * The art is pre-rotated 12° so the stone stands upright; it sinks slightly into the ground. */
const motionPreference=typeof window!=='undefined'&&window.matchMedia?window.matchMedia('(prefers-reduced-motion: reduce)'):null;
let image:HTMLImageElement|null=null;
function art(){if(!image&&typeof Image!=='undefined'){image=new Image();image.decoding='async';image.src='/assets/combat/tombstone.png';}return image;}
/** Brief pause in the defeat pose before the stone drops in. */
export const TOMBSTONE_DELAY=650;
const DROP_MS=360,HEIGHT=66,BASE=.97;
export function drawTombstone(c:CanvasRenderingContext2D,x:number,y:number,age:number,facing:1|-1){
 const reduced=motionPreference?.matches??false,p=reduced?1:Math.max(0,Math.min(1,age/DROP_MS));
 // Falls from above with a short settle, then rests on the ground at the fighter's feet.
 const drop=p<1?(1-p)*(1-p)*-46:0,squash=p<1?1:1+Math.max(0,.08-(age-DROP_MS)/1800)*Math.sin((age-DROP_MS)/45),img=art();
 c.save();c.globalAlpha*=Math.min(1,p*2.2);
 c.fillStyle='rgba(20,16,10,.28)';c.beginPath();c.ellipse(x,y+1,30*Math.min(1,.5+p*.5),6,0,0,Math.PI*2);c.fill();
 c.translate(x,y+drop);c.scale(facing,1/squash);
 if(img?.complete&&img.naturalWidth){const h=HEIGHT,w=h*img.naturalWidth/img.naturalHeight;c.drawImage(img,-w/2,-h*BASE,w,h);}
 else{c.fillStyle='#e8e1cf';c.strokeStyle='#3b2c1d';c.lineWidth=2.5;c.beginPath();c.roundRect(-26,-10,52,12,3);c.fill();c.stroke();c.beginPath();c.moveTo(-18,-10);c.lineTo(-18,-50);c.arc(0,-50,18,Math.PI,0);c.lineTo(18,-10);c.closePath();c.fill();c.stroke();c.fillStyle='#b9ad92';c.fillRect(-2.5,-56,5,22);c.fillRect(-9,-49,18,5);}
 if(!reduced&&age>=DROP_MS&&age<DROP_MS+420){const k=(age-DROP_MS)/420;c.scale(facing,squash);c.fillStyle=`rgba(214,196,160,${.45*(1-k)})`;for(const s of [-1,1]){c.beginPath();c.ellipse(s*(18+k*22),-4-k*6,7+k*6,4+k*3,0,0,Math.PI*2);c.fill();}}
 c.restore();
}
