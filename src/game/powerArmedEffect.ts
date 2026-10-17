import {asset} from './appearance';

/** Power armed on a fighter: the game's own painted gold sigil, re-tinted to fire,
 * standing upright behind the body and turning slowly, with heat bloom behind and
 * embers rising in front. Never a ground disk: it faces the camera like the
 * backpack aura, so POW reads as the same family of effect. */
const sigil=asset('/assets/ui/aura-gold-sigil.png?v=2');
let fireSigil:HTMLCanvasElement|null=null;
const motionPreference=typeof window!=='undefined'&&window.matchMedia?window.matchMedia('(prefers-reduced-motion: reduce)'):null;
/** Gold sigil warmed toward orange at the rim, kept light enough that its painted lines still read. */
function getFireSigil(){
 if(fireSigil)return fireSigil;if(!sigil.complete||!sigil.naturalWidth)return null;
 const size=512,out=document.createElement('canvas');out.width=out.height=size;const c=out.getContext('2d')!;
 c.drawImage(sigil,0,0,size,size);
 c.globalCompositeOperation='source-atop';const ramp=c.createRadialGradient(size/2,size/2,0,size/2,size/2,size/2);
 ramp.addColorStop(0,'rgba(255,240,200,0)');ramp.addColorStop(.4,'rgba(255,130,40,.42)');ramp.addColorStop(1,'rgba(235,55,20,.68)');
 c.fillStyle=ramp;c.fillRect(0,0,size,size);
 return fireSigil=out;
}
export function drawPowerArmed(c:CanvasRenderingContext2D,x:number,y:number,time:number,layer:'back'|'front',quality:'high'|'low'='high'){
 const reduced=motionPreference?.matches??false,t=reduced?0:time,cx=x,cy=y-34,bottom=y+2;
 c.save();
 if(layer==='back'){
  const pulse=1+Math.sin(t/260)*.03,r=60*pulse;
  // Heat bloom gives the seal depth over dark and bright scenery alike.
  const bloom=c.createRadialGradient(cx,cy,8,cx,cy,r*1.25);bloom.addColorStop(0,'rgba(255,170,70,.32)');bloom.addColorStop(.6,'rgba(255,90,30,.12)');bloom.addColorStop(1,'rgba(220,40,20,0)');
  c.fillStyle=bloom;c.beginPath();c.arc(cx,cy,r*1.25,0,Math.PI*2);c.fill();
  const art=getFireSigil();
  if(art){
   // Additive, so the seal reads as light behind the fighter rather than a painted disk.
   c.translate(cx,cy);c.globalCompositeOperation='lighter';
   // Main seal and a smaller counter-rotating copy, as the +9 backpack aura layers it.
   c.save();c.rotate(t/9000*Math.PI*2);c.globalAlpha*=.78+Math.sin(t/420)*.08;c.drawImage(art,-r,-r,r*2,r*2);c.restore();
   c.save();c.rotate(-t/5600*Math.PI*2);c.globalAlpha*=.32+Math.sin(t/420)*.08;const inner=r*.6;c.drawImage(art,-inner,-inner,inner*2,inner*2);c.restore();
   c.strokeStyle='#ffb347';c.lineWidth=1.6;c.globalAlpha=.3+Math.sin(t/300)*.18;c.beginPath();c.arc(0,0,r*.9,0,Math.PI*2);c.stroke();
  }
 }else{
  c.globalCompositeOperation='lighter';const count=quality==='high'?14:7;
  for(let i=0;i<count;i++){
   const seed=i*53.7,phase=((t/1200)+i/count)%1,ex=x+Math.sin(seed)*48+Math.sin(t/240+seed)*6,ey=bottom-4-phase*100,r=1.6+(seed%2);
   c.fillStyle=`rgba(255,${(150+(seed*3)%80)|0},60,${(1-phase)*.9})`;c.beginPath();c.arc(ex,ey,r,0,Math.PI*2);c.fill();
  }
 }
 c.restore();
}
