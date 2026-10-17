/** Power armed on a fighter: flame tongues behind the body and embers in front.
 * Drawn around the silhouette, never as a ground ellipse or cosmetic aura. */
export function drawPowerArmed(c:CanvasRenderingContext2D,x:number,y:number,time:number,layer:'back'|'front',quality:'high'|'low'='high'){
 const top=y-112,bottom=y+2;
 c.save();
 if(layer==='back'){
  const pulse=.8+Math.sin(time/160)*.2,glow=c.createRadialGradient(x,y-56,8,x,y-56,78);glow.addColorStop(0,`rgba(255,150,40,${.42*pulse})`);glow.addColorStop(.6,`rgba(255,70,20,${.18*pulse})`);glow.addColorStop(1,'rgba(255,60,20,0)');
  c.fillStyle=glow;c.fillRect(x-80,y-136,160,150);
  const count=quality==='high'?14:8;
  for(let i=0;i<count;i++){
   const seed=i*97.13,phase=((time/760)+i/count)%1,spread=22+((seed*7)%16),side=(i%2?1:-1)*spread*(1-phase*.45);
   const fx=x+side+Math.sin(time/150+seed)*3,fy=bottom-phase*(bottom-top)*.8,h=44+(seed%22)*(1-phase*.4),alpha=Math.min(1,Math.sin(Math.min(1,phase*1.3)*Math.PI)*1.1),wide=7+(seed%4);
   const flame=c.createLinearGradient(fx,fy,fx,fy-h);flame.addColorStop(0,`rgba(214,30,16,${alpha})`);flame.addColorStop(.35,`rgba(255,110,24,${alpha})`);flame.addColorStop(.75,`rgba(255,206,70,${alpha*.85})`);flame.addColorStop(1,'rgba(255,246,170,0)');
   c.fillStyle=flame;c.beginPath();c.moveTo(fx-wide,fy);c.quadraticCurveTo(fx-wide*.9,fy-h*.5,fx+Math.sin(time/120+seed)*3,fy-h);c.quadraticCurveTo(fx+wide*.9,fy-h*.5,fx+wide,fy);c.closePath();c.fill();
  }
 }else{
  c.globalCompositeOperation='lighter';const count=quality==='high'?14:7;
  for(let i=0;i<count;i++){
   const seed=i*53.7,phase=((time/1200)+i/count)%1,ex=x+Math.sin(seed)*34+Math.sin(time/240+seed)*6,ey=bottom-8-phase*130,r=1.6+(seed%2);
   c.fillStyle=`rgba(255,${(150+(seed*3)%80)|0},60,${(1-phase)*.95})`;c.beginPath();c.arc(ex,ey,r,0,Math.PI*2);c.fill();
  }
 }
 c.restore();
}
