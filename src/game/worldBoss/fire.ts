/**
 * The dragon's fire, drawn in code: many small bits of fire that are born hot, white and yellow, and cool to orange and
 * red as they fly or rise, until they vanish into smoke, like real fire, in the game's warm colors. Each bit is drawn
 * as a soft body and then an additive glow, so together they fuse into one fire with no outlines or layers. Bits are
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
// Flame sprites: a soft teardrop, round at the base and pointed at the tip, hottest low in the middle.
let licks:(HTMLCanvasElement|OffscreenCanvas)[]|null=null;
function makeLicks(){
 licks=STOPS.map(([a,b,c2])=>{const W=64,H=128,cv=canvas(W),g=(cv.getContext('2d') as CanvasRenderingContext2D);cv.height=H;
  const grad=g.createRadialGradient(W/2,H*.74,0,W/2,H*.7,H*.62);grad.addColorStop(0,a);grad.addColorStop(.45,b);grad.addColorStop(.8,c2.slice(0,7)+'99');grad.addColorStop(1,c2);
  g.filter='blur(6px)';g.fillStyle=grad;g.beginPath();g.moveTo(W/2,6);g.bezierCurveTo(W*.62,H*.3,W*.92,H*.52,W*.88,H*.72);g.bezierCurveTo(W*.84,H*.92,W*.16,H*.92,W*.12,H*.72);g.bezierCurveTo(W*.08,H*.52,W*.38,H*.3,W/2,6);g.fill();return cv;});
}
/** A flame licking up from its base at (x, y + r): `r` wide on each side, `stretch` times as tall. */
function lick(c:Ctx,x:number,y:number,r:number,heat:number,alpha:number,stretch:number){
 if(alpha<=.01||r<1)return;if(!licks)makeLicks();
 const sprite=licks![Math.round(clamp(heat)*(HEATS-1))],before=c.globalAlpha,h=r*2*stretch;c.globalAlpha=before*alpha;c.drawImage(sprite as CanvasImageSource,x-r,y+r-h*.9,r*2,h);c.globalAlpha=before;
}
export function smoke(c:Ctx,x:number,y:number,r:number,alpha:number){
 if(alpha<=.01||r<1)return;if(!sprites)makeSprites();const before=c.globalAlpha;c.globalAlpha=before*alpha;c.drawImage(smokeSprite as CanvasImageSource,x-r,y-r,r*2,r*2);c.globalAlpha=before;
}

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
  // A hot bed under the flames joins them into one fire.
  for(let i=0;i<4;i++){const u=i/3-.5;puff(c,x+u*width*.8,y-height*.08,height*.3*(.6+.4*life),.75,.6*life);}
  // Flames: bits of fire born all along the bed, rising, shrinking and cooling from yellow to red as they go, drawn
  // like the jet (a soft body, then an additive glow) so it is the same fire. A bit is as strong as the fire was when it was born.
  const step=high?9:16,lifeAt=(at:number)=>clamp(at/200)*(1-clamp((at-burn)/fade))**1.4,bits:{x:number;y:number;r:number;heat:number;alpha:number;tall:number}[]=[];
  for(let n=Math.max(0,Math.floor((age-700)/step));n*step<=Math.min(age,end);n++){
   const born=n*step+hash(seed*13+n)*step,strength=lifeAt(born);if(born>age||strength<=0)continue;
   const span=600*(.7+.5*hash(seed+n*3)),k=(age-born)/span;if(k<0||k>=1)continue;
   const u=hash(seed*7+n*5)-.5,center=1-Math.abs(u)*1.4,rise=height*(.75+.55*hash(seed+n*11))*(.55+.45*center)*strength;
   const r=height*.2*(.6+.5*hash(seed+n*17))*(.5+.5*strength)*(1-.6*k);
   bits.push({x:x+u*width*(.4+.6*strength)+Math.sin(born/90+k*4)*12*k,y:y-rise*k**.9+r*.3,r,heat:clamp(1-.95*k)*(.6+.4*center),alpha:Math.min(1,k*8)*(1-k)**.7,tall:1.3+1.4*hash(seed+n*19)});
  }
  bits.sort((a,b)=>a.heat-b.heat);
  for(const b of bits)lick(c,b.x,b.y,b.r*1.25,b.heat*.55,.32*b.alpha,b.tall);
  c.save();c.globalCompositeOperation='lighter';for(const b of bits)lick(c,b.x,b.y,b.r*.8,b.heat,.45*b.alpha,b.tall*.9);c.restore();
  if(high&&life>.2)for(let i=0;i<4;i++){const k=((t*.0012+hash(seed+i*7))%1),sx=x+(hash(seed*3+i)-.5)*width+Math.sin(t/160+i*2)*10;
   c.save();c.globalAlpha*=(1-k)*life;c.fillStyle=i%2?'#ffe08a':'#ff9a36';c.beginPath();c.arc(sx,y-height*(.5+1.2*k),2.6*(1-k)+.8,0,Math.PI*2);c.fill();c.restore();}
 }
 // Smoke from the embers as it goes out.
 const fume=clamp((age-burn*.5)/(fade+400))*(1-clamp((age-end)/1100));
 if(fume>0)for(let i=0;i<(high?4:2);i++){const r=hash(seed*7+i),k=((age/1100+r)%1),sx=x+(r-.5)*width*.7;smoke(c,sx+16*k,y-height*.25-90*k,12+26*k,.42*fume*(1-k));}
}
/**
 * A dragon's jet of fire: one continuous flow, poured from `throat` out through `gap` (the mouth opening) and on to
 * `to`, while `age` is between `start` and `stop`. Every bit of fire leaves the throat white-hot and narrow, widens,
 * cools to orange and red and churns more the further it flies; the last ones still fly on after the mouth closes, so
 * the jet breaks off and is gone. Each bit is drawn twice, a soft body and an additive glow, so the jet reads as one
 * fused fire, without outlines or layers. The path curves smoothly out of the mouth (it never bends at the teeth).
 * `part` draws only the fire inside the mouth (between the jaw and the skull) or only the fire outside it.
 */
export function jet(c:Ctx,throat:{x:number;y:number},gap:{x:number;y:number},to:{x:number;y:number},age:number,start:number,stop:number,travel:number,size:number,high:boolean,part:'inside'|'outside'){
 const inLen=Math.hypot(gap.x-throat.x,gap.y-throat.y)||1,dirX=(gap.x-throat.x)/inLen,dirY=(gap.y-throat.y)/inLen;
 const outLen=Math.hypot(to.x-gap.x,to.y-gap.y)||1,ctrl={x:gap.x+dirX*outLen*.35,y:gap.y+dirY*outLen*.35},split=inLen/(inLen+outLen*1.05);
 const step=high?8:14,bits:{x:number;y:number;r:number;seed:number;q:number;heat:number;alpha:number}[]=[];
 for(let n=Math.floor(start/step);n*step<=stop;n++){
  const born=n*step+hash(n+1)*step*.7;if(born<start||born>stop)continue;const s=(age-born)/travel;if(s<0||s>=1.18)continue;
  if(part==='inside'?s>=split:s<split)continue;
  let x:number,y:number,tx:number,ty:number;
  if(s<split){const u=s/split;x=throat.x+(gap.x-throat.x)*u;y=throat.y+(gap.y-throat.y)*u;tx=dirX;ty=dirY;}
  else{const u=Math.min(1,(s-split)/(1-split)),v=1-u;x=v*v*gap.x+2*v*u*ctrl.x+u*u*to.x;y=v*v*gap.y+2*v*u*ctrl.y+u*u*to.y;tx=2*v*(ctrl.x-gap.x)+2*u*(to.x-ctrl.x);ty=2*v*(ctrl.y-gap.y)+2*u*(to.y-ctrl.y);const l=Math.hypot(tx,ty)||1;tx/=l;ty/=l;}
  const q=Math.min(1,s),over=Math.max(0,s-1)/.18,r=size*(.16+1.12*q**.85)*(.68+.64*hash(n+3))*(1+.7*over);
  // Turbulence across the flow grows with distance; hot air lifts the far end a little; at the end it splashes out.
  const lateral=((hash(n)-.5)*.9+Math.sin(born/70+q*7)*.5)*r*Math.min(1,q*1.6)*1.05;
  x+=-ty*lateral+(hash(n+5)-.5)*size*2.4*over;y+=tx*lateral-r*.22*q*q-size*.35*over;
  bits.push({x,y,r,seed:n,q,heat:clamp(1-.82*q**1.1+(hash(n+7)-.5)*.14-.25*over),alpha:1-clamp(over)});
 }
 // The far, cooler fire goes down first and the hot heart near the mouth on top.
 bits.sort((a,b)=>a.heat-b.heat);
 // Away from the mouth the fire rolls: flames lick up off the top of the flow and darken to smoke.
 for(const b of bits)if(b.q>.3){const k=(b.q-.3)/.7,up=b.r*(.55+.5*hash(b.seed+13));smoke(c,b.x+b.r*.2,b.y-up*1.6,b.r*.75,.16*k*b.alpha);puff(c,b.x+(hash(b.seed+17)-.5)*b.r,b.y-up,b.r*.55,b.heat*.6,.5*k*b.alpha);}
 for(const b of bits)puff(c,b.x,b.y,b.r*1.3,b.heat*.55,.42*b.alpha);
 c.save();c.globalCompositeOperation='lighter';
 for(const b of bits)puff(c,b.x,b.y,b.r*.85,b.heat,.5*b.alpha);
 c.restore();
}
