/** Power armed on a fighter: a simple soft aura of warm light behind the body,
 * gently pulsing, with a few embers rising in front (user request, 17/10/2026:
 * "um efeito de aura simples"). Never a ground disk or a painted sigil. */
const motionPreference=typeof window!=='undefined'&&window.matchMedia?window.matchMedia('(prefers-reduced-motion: reduce)'):null;
export function drawPowerArmed(c:CanvasRenderingContext2D,x:number,y:number,time:number,layer:'back'|'front',quality:'high'|'low'='high'){
 const reduced=motionPreference?.matches??false,t=reduced?0:time,cx=x,cy=y-22,bottom=y+2;
 c.save();
 if(layer==='back'){
  // Small and discreet (user request): a soft warm halo hugging the body, no rim.
  const pulse=.8+Math.sin(t/320)*.2,r=38+Math.sin(t/320)*2;
  const glow=c.createRadialGradient(cx,cy,r*.2,cx,cy,r);
  glow.addColorStop(0,`rgba(255,210,120,${.55*pulse})`);glow.addColorStop(.6,`rgba(255,140,40,${.3*pulse})`);glow.addColorStop(1,'rgba(255,100,20,0)');
  c.globalCompositeOperation='lighter';c.fillStyle=glow;c.beginPath();c.ellipse(cx,cy,r*1.15,r*.85,0,0,Math.PI*2);c.fill();
 }else{
  c.globalCompositeOperation='lighter';const count=quality==='high'?5:3;
  for(let i=0;i<count;i++){
   const seed=i*53.7,phase=((t/1300)+i/count)%1,ex=x+Math.sin(seed)*30+Math.sin(t/260+seed)*5,ey=bottom-6-phase*55,r=1.4+(seed%1.5);
   c.fillStyle=`rgba(255,${(170+(seed*3)%60)|0},80,${(1-phase)*.8})`;c.beginPath();c.arc(ex,ey,r,0,Math.PI*2);c.fill();
  }
 }
 c.restore();
}
