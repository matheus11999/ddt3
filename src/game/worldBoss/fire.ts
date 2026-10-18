/**
 * The dragon's fire, drawn in code: layered flame tongues (red outside, orange, yellow, a white-hot core) and puffs of
 * fire that rise, cool from yellow to red and vanish, like real fire, painted in the game's warm style. Puffs are
 * stamped from a few small sprites made once, so a breath of fire costs a few hundred image draws a frame.
 * Everything is a pure function of time and a seed: every client draws the same fire for the same server time and
 * nothing is kept between frames. A fire always has a life: it flares, burns and dies out.
 */
type Ctx=CanvasRenderingContext2D;
/** A stable pseudo-random number in [0, 1) for a seed. */
export const hash=(n:number)=>{const s=Math.sin(n*127.1+311.7)*43758.5453;return s-Math.floor(s);};
const clamp=(v:number,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));

// ── Puff sprites: soft balls of fire from white-hot to dying red, then smoke ──
const HEATS=8,SPRITE=96;
let sprites:(HTMLCanvasElement|OffscreenCanvas)[]|null=null,smokeSprite:HTMLCanvasElement|OffscreenCanvas|null=null;
function canvas(size:number){return typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(size,size):Object.assign(document.createElement('canvas'),{width:size,height:size});}
const STOPS:[string,string,string][]=[
 // [center, middle, edge] from the coolest to the hottest
 ['#a2200cdd','#7a160aaa','#5a100800'],['#c82c10ee','#a2200cbb','#7a160a00'],['#e8461a','#c82c10cc','#a2200c00'],['#f86a1e','#e8461add','#c82c1000'],
 ['#ff8e2a','#f86a1e','#e8461a00'],['#ffb43a','#ff8a26','#f2561a00'],['#ffd96a','#ffae36','#ff7a2200'],['#fff7d0','#ffd45c','#ff9a2c00'],
];
function makeSprites(){
 sprites=STOPS.map(([a,b,c2])=>{const cv=canvas(SPRITE),g=(cv.getContext('2d') as CanvasRenderingContext2D),r=SPRITE/2,grad=g.createRadialGradient(r,r*1.08,0,r,r,r);
  grad.addColorStop(0,a);grad.addColorStop(.5,b);grad.addColorStop(.75,c2.slice(0,7)+'77');grad.addColorStop(1,c2);g.fillStyle=grad;g.beginPath();g.arc(r,r,r,0,Math.PI*2);g.fill();return cv;});
 const cv=canvas(SPRITE),g=(cv.getContext('2d') as CanvasRenderingContext2D),r=SPRITE/2,grad=g.createRadialGradient(r,r,0,r,r,r);
 grad.addColorStop(0,'#5d524dcc');grad.addColorStop(.6,'#6f646077');grad.addColorStop(1,'#7a6f6a00');g.fillStyle=grad;g.beginPath();g.arc(r,r,r,0,Math.PI*2);g.fill();smokeSprite=cv;
}
/** A ball of fire at (x, y), radius `r`; `heat` 1 is white-hot, 0 is a dying red. */
export function puff(c:Ctx,x:number,y:number,r:number,heat:number,alpha=1){
 if(alpha<=.01||r<1)return;if(!sprites)makeSprites();
 const sprite=sprites![Math.round(clamp(heat)*(HEATS-1))],before=c.globalAlpha;c.globalAlpha=before*alpha;c.drawImage(sprite as CanvasImageSource,x-r,y-r,r*2,r*2);c.globalAlpha=before;
}
export function smoke(c:Ctx,x:number,y:number,r:number,alpha:number){
 if(alpha<=.01||r<1)return;if(!sprites)makeSprites();const before=c.globalAlpha;c.globalAlpha=before*alpha;c.drawImage(smokeSprite as CanvasImageSource,x-r,y-r,r*2,r*2);c.globalAlpha=before;
}

// ── Flame tongues ──
const LAYERS=[
 // color, width, height, how much its tip sways: red outside, white-hot inside
 {color:'#d8301a',w:1,h:1,sway:1},{color:'#f4661e',w:.8,h:.84,sway:1.2},{color:'#ffaa30',w:.58,h:.64,sway:1.4},{color:'#ffe680',w:.36,h:.42,sway:1.6},{color:'#fffbe8',w:.2,h:.22,sway:1.7},
];
function tonguePath(c:Ctx,tip:number,bend:number,fork:number){
 // Base at 0, tip at -1; a second, smaller tip on one side makes it look like it is licking upward.
 c.beginPath();c.moveTo(tip,-1);
 c.bezierCurveTo(.12+bend,-.7,.5,-.48,.48,-.12);
 c.quadraticCurveTo(.44,.14,0,.15);c.quadraticCurveTo(-.44,.14,-.48,-.12);
 c.bezierCurveTo(-.52,-.38,-.4+fork*.1,-.58,-.3+fork*.12,-.74+fork*.06);
 c.quadraticCurveTo(-.2+bend*.5,-.5,-.08+bend*.6,-.62);
 c.bezierCurveTo(-.02+bend*.8,-.8,tip-.06,-.9,tip,-1);c.closePath();
}
interface Tongue {x:number;y:number;h:number;w:number;seed:number;alpha:number;lean:number;angle:number;}
function tongueLayer(c:Ctx,g:Tongue,i:number,t:number){
 const L=LAYERS[i],ph=t/(120-i*9)+g.seed*6.3+i*1.7;
 const tip=(Math.sin(ph)*.16+Math.sin(ph*2.3+1)*.06)*L.sway+g.lean,bend=Math.sin(ph*.8+2)*.08*L.sway+g.lean*.6,lick=1+Math.sin(ph*1.9)*.1;
 c.save();c.globalAlpha*=g.alpha;c.translate(g.x,g.y);if(g.angle)c.rotate(g.angle);c.scale(g.w*L.w,g.h*L.h*lick);c.fillStyle=L.color;tonguePath(c,tip,bend,Math.sin(ph*1.3));c.fill();c.restore();
}
/** Several tongues drawn layer by layer (all the red, then all the orange...), so they merge into one fire with a hot heart. */
function tongues(c:Ctx,list:Tongue[],t:number){for(let i=0;i<LAYERS.length;i++)for(const g of list)if(g.alpha>.01&&g.h>=3)tongueLayer(c,g,i,t);}
/**
 * One flame tongue with its base at (x, y), `h` tall and `w` wide, tip up (or along `angle`). `t` animates it and
 * `seed` makes each tongue flicker on its own; `lean` bends it (wind, motion).
 */
export function tongue(c:Ctx,x:number,y:number,h:number,w:number,t:number,seed:number,alpha=1,lean=0,angle=0){tongues(c,[{x,y,h,w,seed,alpha,lean,angle}],t);}
/** The warm light a fire throws around it (additive). */
export function glow(c:Ctx,x:number,y:number,r:number,alpha:number){
 if(alpha<=.01||r<2)return;c.save();c.globalCompositeOperation='lighter';puff(c,x,y,r,.35,alpha*.45);c.restore();
}
/**
 * A fire burning on the ground at (x, y), `width` wide and up to `height` tall, with a life: `age` ms since it caught,
 * `burn` ms of full fire, then it dies down over `fade` ms, leaving smoke for a moment. Nothing keeps burning.
 */
export function groundFire(c:Ctx,x:number,y:number,width:number,height:number,age:number,burn:number,fade:number,t:number,seed:number,high:boolean){
 const end=burn+fade;if(age<0||age>end+1100)return;
 const flare=clamp(age/200),dying=clamp((age-burn)/fade),life=flare*(1-dying)**1.4;
 if(life>0){
  glow(c,x,y-height*.3,width*.6+height*.4,.7*life);
  // A hot bed under the tongues joins them into one fire.
  for(let i=0;i<4;i++){const u=i/3-.5;puff(c,x+u*width*.8,y-height*.08,height*.3*(.6+.4*life),.75,.6*life);}
  const count=Math.max(2,Math.round(width/(high?16:28)));
  const list:Tongue[]=[];
  for(let i=0;i<count;i++){
   const r=hash(seed*31+i),u=count===1?0:i/(count-1)-.5,center=1-Math.abs(u)*1.3;
   // Each tongue dies on its own: the edges go first, the middle lasts.
   const own=clamp(life*1.3-(1-center)*dying*.9-r*dying*.3);if(own<=0)continue;
   const h=height*(.5+.5*center)*(.5+.5*r)*(.4+.6*own)*(1+.12*Math.sin(t/170+r*20));
   list.push({x:x+u*width+(r-.5)*20,y:y+3,h,w:h*(.62+.28*hash(r*91)),seed:seed+i,alpha:clamp(own*1.5),lean:(r-.5)*.3,angle:0});
  }
  tongues(c,list,t);
  if(high&&life>.2)for(let i=0;i<4;i++){const k=((t*.0012+hash(seed+i*7))%1),sx=x+(hash(seed*3+i)-.5)*width+Math.sin(t/160+i*2)*10;
   c.save();c.globalAlpha*=(1-k)*life;c.fillStyle=i%2?'#ffe08a':'#ff9a36';c.beginPath();c.arc(sx,y-height*(.5+1.2*k),2.6*(1-k)+.8,0,Math.PI*2);c.fill();c.restore();}
 }
 // Smoke from the embers as it goes out.
 const fume=clamp((age-burn*.5)/(fade+400))*(1-clamp((age-end)/1100));
 if(fume>0)for(let i=0;i<(high?4:2);i++){const r=hash(seed*7+i),k=((age/1100+r)%1),sx=x+(r-.5)*width*.7;smoke(c,sx+16*k,y-height*.25-90*k,12+26*k,.42*fume*(1-k));}
}
/**
 * A stream of fire poured from `from` along a curve (control point `via`) to `to`, while `age` is between `start` and
 * `stop`: puffs leave the mouth hot and fast, spread out and cool as they fly, and the last ones reach the ground after
 * the mouth closes, so the stream breaks off and is gone.
 */
export function stream(c:Ctx,from:{x:number;y:number},via:{x:number;y:number},to:{x:number;y:number},age:number,start:number,stop:number,travel:number,size:number,high:boolean,t=age){
 const step=high?12:22,points:{x:number;y:number;r:number;heat:number;alpha:number;angle:number;seed:number}[]=[];
 for(let n=Math.floor(start/step);n*step<=stop;n++){
  const seed=n,born=n*step+hash(seed+1)*step*.8,s=(age-born)/travel;if(born<start||s<0||s>=1.15)continue;const q=Math.min(1,s),u=1-q;
  const x=u*u*from.x+2*u*q*via.x+q*q*to.x,y=u*u*from.y+2*u*q*via.y+q*q*to.y,dx=2*u*(via.x-from.x)+2*q*(to.x-via.x),dy=2*u*(via.y-from.y)+2*q*(to.y-via.y),len=Math.hypot(dx,dy)||1;
  // Turbulence across the stream grows with distance; past the end the puffs splash out and fade.
  const spread=((hash(seed)-.5)*1.2+Math.sin(born/90+q*5)*.35)*size*q,over=Math.max(0,s-1)/.15,nx=-dy/len,ny=dx/len;
  points.push({x:x+nx*spread+(hash(seed+5)-.5)*size*over*2,y:y+ny*spread-size*.5*over,r:size*(.3+.75*q)*(1+.4*over)*(.6+.8*hash(seed+9)),heat:1-q*.35-over*.3,alpha:s<1?1:1-over,angle:Math.atan2(-dx/len,dy/len),seed});
 }
 // A soft red body, then each puff as a flame licking backwards with its white-hot heart: a jet of fire, not a row of balls.
 for(const p of points)puff(c,p.x,p.y,p.r*1.35,.3,p.alpha*.45);
 tongues(c,points.map(p=>({x:p.x,y:p.y+p.r*.35,h:p.r*(2.2+.8*hash(p.seed+2)),w:p.r*1.25,seed:p.seed,alpha:p.alpha,lean:0,angle:p.angle})),t);
 for(const p of points)if(p.heat>.75)puff(c,p.x,p.y,p.r*.5,p.heat,p.alpha*.8);
}
