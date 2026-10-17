// A critical hit leaves the target sooty for a moment, as in DDTank. Works on any outfit because it
// tints the whole avatar draw instead of needing art per piece.
// Full burn, then a quick return: no long half-burnt phase (user, 17/10/2026).
export const SCORCH_HOLD=3000,SCORCH_FADE=250;

/** 0..1 strength of the burn, from the age of the critical hit in ms. */
export function scorchAmount(age:number){
 if(!Number.isFinite(age)||age<0)return 0;
 if(age<120)return age/120;
 if(age<SCORCH_HOLD)return 1;
 return Math.max(0,1-(age-SCORCH_HOLD)/SCORCH_FADE);
}

/** Canvas filter that darkens the colours to a burnt brown-black while keeping the painted shading. */
export function scorchFilter(amount:number){
 const k=Math.max(0,Math.min(1,amount));
 return `sepia(${(.55*k).toFixed(3)}) saturate(${(1-.35*k).toFixed(3)}) brightness(${(1-.58*k).toFixed(3)}) contrast(${(1+.12*k).toFixed(3)})`;
}

const PUFFS=[[-14,0],[9,340],[-2,690],[16,1030]] as const;
/** A few thin grey wisps rising from the body while it is still burnt. */
export function drawScorchSmoke(c:CanvasRenderingContext2D,x:number,y:number,age:number,amount:number,size=112){
 if(amount<=0)return;
 const cycle=1400;
 c.save();
 for(const [offset,delay] of PUFFS){
  const life=((age+cycle-delay)%cycle)/cycle,rise=life*size*.55,radius=size*(.07+.1*life),alpha=.32*amount*Math.sin(Math.PI*life);
  if(alpha<=.01)continue;
  const px=x+offset*size/112+Math.sin((age+delay)/260)*4,py=y-size*.45-rise;
  const g=c.createRadialGradient(px,py,0,px,py,radius);
  g.addColorStop(0,`rgba(70,64,60,${alpha.toFixed(3)})`);g.addColorStop(1,'rgba(70,64,60,0)');
  c.fillStyle=g;c.beginPath();c.arc(px,py,radius,0,Math.PI*2);c.fill();
 }
 c.restore();
}
