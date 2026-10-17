/** Power armed on a fighter: a simple soft aura of warm light behind the body,
 * gently pulsing, with a few embers rising in front (user request, 17/10/2026:
 * "um efeito de aura simples"). Never a ground disk or a painted sigil. */
const motionPreference=typeof window!=='undefined'&&window.matchMedia?window.matchMedia('(prefers-reduced-motion: reduce)'):null;
export function drawPowerArmed(c:CanvasRenderingContext2D,x:number,y:number,time:number,layer:'back'|'front',quality:'high'|'low'='high'){
 const reduced=motionPreference?.matches??false,t=reduced?0:time,cx=x,cy=y-30,bottom=y+2;
 c.save();
 if(layer==='back'){
  const pulse=.85+Math.sin(t/320)*.15,r=58+Math.sin(t/320)*3;
  const glow=c.createRadialGradient(cx,cy,r*.15,cx,cy,r);
  glow.addColorStop(0,`rgba(255,220,130,${.75*pulse})`);glow.addColorStop(.5,`rgba(255,150,40,${.55*pulse})`);glow.addColorStop(.85,`rgba(255,100,20,${.25*pulse})`);glow.addColorStop(1,'rgba(255,90,20,0)');
  c.globalCompositeOperation='lighter';c.fillStyle=glow;c.beginPath();c.arc(cx,cy,r,0,Math.PI*2);c.fill();
  // One soft rim so the aura reads on bright maps too.
  c.strokeStyle=`rgba(255,200,90,${.45*pulse})`;c.lineWidth=3;c.shadowColor='#ffb040';c.shadowBlur=quality==='high'?10:0;c.beginPath();c.arc(cx,cy,r*.82,0,Math.PI*2);c.stroke();
 }else{
  c.globalCompositeOperation='lighter';const count=quality==='high'?8:4;
  for(let i=0;i<count;i++){
   const seed=i*53.7,phase=((t/1300)+i/count)%1,ex=x+Math.sin(seed)*40+Math.sin(t/260+seed)*5,ey=bottom-6-phase*80,r=1.4+(seed%1.5);
   c.fillStyle=`rgba(255,${(170+(seed*3)%60)|0},80,${(1-phase)*.8})`;c.beginPath();c.arc(ex,ey,r,0,Math.PI*2);c.fill();
  }
 }
 c.restore();
}
