import type {Projectile} from '../../shared/protocol';

/**
 * Bobina do Trovão drawn in code (matheus, 20/10: the painted ball looked like a small blob with a stray wire; "it is a
 * laser, draw it in code but keep our design"). Normal shot = a smooth laser streak with a hot orb at the head and arcs
 * crackling around it; POW = a jagged lightning bolt, thicker, twin-coloured at +15. Impact = flash, radial branching
 * lightning, a crackling ring and sparks. Each phase keeps the colours of its painted column (+0 white-blue, +10 cyan
 * with gold sparks, +12 deep blue with orange specks, +15 ice-blue with ruby), and the POW +10 turns gold so it no longer
 * repeats the +0 pink. Everything is strokes and the shared cached glow: no shadows, no per-frame allocations beyond paths.
 */
export interface ThunderPalette {glow:string;deep:string;mid:string;core:string;accent?:string;twin?:string}
export const THUNDER_PALETTES:{normal:readonly ThunderPalette[];pow:readonly ThunderPalette[]}={
 normal:[
  {glow:'#5f7dff',deep:'#2b3fae',mid:'#9fc4ff',core:'#ffffff'},
  {glow:'#13b6d6',deep:'#0a5f86',mid:'#46f2ff',core:'#eaffff',accent:'#ffc25a'},
  {glow:'#2541ff',deep:'#141c8c',mid:'#5a86ff',core:'#e2ecff',accent:'#ff9a3c'},
  {glow:'#4fc8ff',deep:'#1d5f9e',mid:'#bff4ff',core:'#ffffff',accent:'#ff3b5c',twin:'#ff3b5c'}
 ],
 pow:[
  {glow:'#c03cff',deep:'#6e1a92',mid:'#ff7ae6',core:'#fff0fd'},
  {glow:'#ff8a1e',deep:'#a2440a',mid:'#ffc84a',core:'#fff6dc',accent:'#46f2ff'},
  {glow:'#6a3cff',deep:'#33189a',mid:'#a98bff',core:'#f0eaff',accent:'#5a86ff'},
  {glow:'#4fc8ff',deep:'#1d5f9e',mid:'#d8f8ff',core:'#ffffff',accent:'#ff3b5c',twin:'#ff3b5c'}
 ]
};
type Glow=(c:CanvasRenderingContext2D,x:number,y:number,radius:number,color:string,opacity:number)=>void;
export interface ThunderOptions {low:boolean;still:boolean}
const TAU=Math.PI*2;
const noise=(n:number)=>{const value=Math.sin(n*127.1+311.7)*43758.5453;return value-Math.floor(value);};
const clamp=(value:number,min=0,max=1)=>Math.max(min,Math.min(max,value));

/** Lightning from (x0,y0) to (x1,y1): `steps` kinks, each pushed sideways by up to `jag`, reseeded by `seed`. */
function bolt(c:CanvasRenderingContext2D,x0:number,y0:number,x1:number,y1:number,steps:number,jag:number,seed:number){
 const dx=x1-x0,dy=y1-y0,length=Math.hypot(dx,dy)||1,nx=-dy/length,ny=dx/length;
 c.moveTo(x0,y0);
 for(let i=1;i<steps;i++){const t=i/steps,off=(noise(seed+i*7.13)-.5)*2*jag*Math.sin(Math.PI*t);c.lineTo(x0+dx*t+nx*off,y0+dy*t+ny*off);}
 c.lineTo(x1,y1);
}
/** Lightning vertices from (x0,y0) to (x1,y1), same kinks as `bolt`. */
function boltPoints(x0:number,y0:number,x1:number,y1:number,steps:number,jag:number,seed:number){
 const dx=x1-x0,dy=y1-y0,length=Math.hypot(dx,dy)||1,nx=-dy/length,ny=dx/length,out:number[][]=[[x0,y0]];
 for(let i=1;i<steps;i++){const t=i/steps,off=(noise(seed+i*7.13)-.5)*2*jag*Math.sin(Math.PI*t);out.push([x0+dx*t+nx*off,y0+dy*t+ny*off]);}
 out.push([x1,y1]);return out;
}
/** `layered` along a polyline whose width thins from the root to a sharp tip, so branches read as lightning, not worms. */
function tapered(c:CanvasRenderingContext2D,verts:number[][],palette:ThunderPalette,width:number,alpha:number,body=palette.mid){
 const last=verts.length-1;
 for(const [color,w,a] of [[palette.glow,width*3.6,.16],[palette.deep,width*2,.85],[body,width*1.3,1],[palette.core,width*.5,1]] as const){
  c.strokeStyle=color;c.globalAlpha=alpha*a;
  for(let i=0;i<last;i++){const t=i/last;c.lineWidth=Math.max(.4,w*(1-t*.82));c.beginPath();c.moveTo(verts[i][0],verts[i][1]);c.lineTo(verts[i+1][0],verts[i+1][1]);c.stroke();}
 }
}
/** Four passes over the same path, like our painted effects: soft halo, dark coloured edge (reads on light skies),
 * saturated body, white-hot core. */
function layered(c:CanvasRenderingContext2D,draw:()=>void,palette:ThunderPalette,width:number,alpha=1,body=palette.mid){
 for(const [color,w,a] of [[palette.glow,width*4,.18],[palette.deep,width*2.2,.85],[body,width*1.45,1],[palette.core,width*.55,1]] as const){
  c.strokeStyle=color;c.lineWidth=Math.max(.6,w);c.globalAlpha=alpha*a;c.beginPath();draw();c.stroke();
 }
}

export function drawThunderProjectile(c:CanvasRenderingContext2D,p:Projectile,sample:number,tier:number,time:number,options:ThunderOptions,glow:Glow){
 const pow=!!p.powered,palette=(pow?THUNDER_PALETTES.pow:THUNDER_PALETTES.normal)[tier],points=p.points;
 const floor=Math.floor(sample),fraction=sample-floor,a=points[floor],b=points[Math.min(points.length-1,floor+1)];
 const tip:[number,number]=[a[0]+(b[0]-a[0])*fraction,a[1]+(b[1]-a[1])*fraction];
 const span=Math.min(options.low?10:24,(pow?14:12)+tier*4),start=Math.max(0,floor-span),flicker=options.still?0:Math.floor(time/45);
 const back=points[Math.max(0,floor-2)],angle=Math.atan2(tip[1]-back[1],tip[0]-back[0])||0;
 const width=(pow?4:3.2)+tier*.6;
 c.save();c.lineCap='round';c.lineJoin='round';
 // Trail: a smooth laser for the normal shot, a jagged bolt for the POW (twin bolts at +15), fading toward the tail.
 const trail=(lane:number,seedOffset:number)=>{
  const out:number[][]=[];
  if(pow){
   const steps=Math.max(3,Math.round(span*.8)),jag=3+tier*.8;out.push(points[start]);
   for(let i=1;i<steps;i++){const j=start+(floor-start)*i/steps,k=Math.floor(j),q=points[k],r=points[Math.min(points.length-1,k+1)],t=j-k,x=q[0]+(r[0]-q[0])*t,y=q[1]+(r[1]-q[1])*t,
    side=(i%2?1:-1)*(jag*(.55+noise(flicker+i*3.1+seedOffset)*.45))+lane*2.5;out.push([x-Math.sin(angle)*side,y+Math.cos(angle)*side]);}
  }else for(let j=start;j<=floor;j++)out.push(points[j]);
  out.push(tip);return out;
 };
 const stroke=(verts:number[][],pal:ThunderPalette,w:number,alpha:number)=>{
  const last=verts.length-1;if(last<1)return;
  for(const [color,lw,a] of [[pal.glow,w*4,.18],[pal.deep,w*2.2,.85],[pal.mid,w*1.45,1],[pal.core,w*.55,1]] as const){
   c.strokeStyle=color;
   for(let i=0;i<last;i++){const t=(i+1)/last;c.globalAlpha=alpha*a*t*t;c.lineWidth=Math.max(.5,lw*(.35+.65*t));c.beginPath();c.moveTo(verts[i][0],verts[i][1]);c.lineTo(verts[i+1][0],verts[i+1][1]);c.stroke();}
  }
 };
 stroke(trail(0,0),palette,width,1);
 if(palette.twin)stroke(trail(1.6,9),{...palette,mid:palette.twin,glow:palette.twin,deep:'#7a0c22'},width*.6,.8);
 // Arcs crackling around the head, reseeded every 45 ms.
 const arcs=options.low?1:1+tier+(pow?1:0),reach=(pow?20:14)+tier*3;
 c.lineWidth=.9;
 for(let n=0;n<arcs;n++){
  const seed=flicker*13+n*31,theta=angle+Math.PI+(noise(seed)-.5)*2.2,length=reach*(.55+noise(seed+2)*.45);
  c.strokeStyle=n%2&&palette.twin?palette.twin:palette.mid;c.globalAlpha=.55+noise(seed+5)*.4;
  c.beginPath();bolt(c,tip[0],tip[1],tip[0]+Math.cos(theta)*length,tip[1]+Math.sin(theta)*length,4,3,seed);c.stroke();
 }
 // Accent sparks left behind along the path (+10 gold, +12 orange, +15 ruby).
 if(palette.accent&&!options.low){
  c.fillStyle=palette.accent;
  for(let n=0;n<3+tier*2;n++){const age=((options.still?0:time/520)+n/(3+tier*2))%1,j=Math.max(0,sample-age*span),k=Math.floor(j),q=points[k];if(!q)continue;
   const drift=(noise(n*5.7)-.5)*10*age;c.globalAlpha=(1-age)*.9;c.beginPath();c.arc(q[0]-Math.sin(angle)*drift,q[1]+Math.cos(angle)*drift+age*6,1.1+tier*.25,0,TAU);c.fill();}
 }
 // Head: halo, coloured orb, white core.
 const pulse=options.still?0:Math.sin(time/70)*.12,orb=((pow?9:8)+tier*1.5)*(1+pulse);
 c.globalAlpha=1;glow(c,tip[0],tip[1],orb*4.2,palette.glow,.9);glow(c,tip[0],tip[1],orb*2.2,palette.mid,.9);
 c.fillStyle=palette.deep;c.globalAlpha=.9;c.beginPath();c.arc(tip[0],tip[1],orb*(pow?.75:.95),0,TAU);c.fill();
 c.fillStyle=palette.mid;c.beginPath();c.arc(tip[0],tip[1],orb*(pow?.6:.8),0,TAU);c.fill();
 c.fillStyle=palette.core;c.globalAlpha=1;c.beginPath();
 if(pow){c.save();c.translate(tip[0],tip[1]);c.rotate(angle);c.moveTo(orb*1.8,0);c.lineTo(-orb*.5,-orb*.8);c.lineTo(-orb*.1,0);c.lineTo(-orb*.5,orb*.8);c.closePath();c.fill();c.restore();}
 else{c.arc(tip[0],tip[1],orb*.5,0,TAU);c.fill();}
 c.restore();
}

export function drawThunderImpact(c:CanvasRenderingContext2D,p:Projectile,elapsed:number,tier:number,options:ThunderOptions,glow:Glow){
 const pow=!!p.powered,duration=(pow?640:540)+tier*25,age=elapsed/duration;if(age<0||age>=1)return;
 const palette=(pow?THUNDER_PALETTES.pow:THUNDER_PALETTES.normal)[tier],radius=Math.min(130,Math.max(10,p.impact.radius))*(pow?1.7:1.5)*(1+tier*.08);
 const seed=Math.round(p.impact.x*7+p.impact.y*13),flicker=options.still?0:Math.floor(elapsed/60),fade=Math.pow(1-age,1.1),grow=1-Math.pow(1-clamp(age/.22),3);
 c.save();c.translate(p.impact.x,p.impact.y);c.lineCap='round';c.lineJoin='round';
 // Flash: white-hot core and coloured bloom, gone in the first quarter.
 if(age<.3){const f=1-age/.3;glow(c,0,0,radius*(.8+age*1.8),palette.glow,f);glow(c,0,0,radius*(.45+age*1.1),palette.mid,f);glow(c,0,0,radius*(.25+age*.6),palette.core,f);}
 glow(c,0,0,radius*.35,palette.core,.7*fade);
 glow(c,0,0,radius*1.1,palette.mid,.35*fade);
 // Radial lightning: main branches grow out, then flicker and fade; sub-branches from +12 and on every POW.
 const branches=(options.low?4:5)+tier+(pow?2:0);
 for(let n=0;n<branches;n++){
  const s=seed+n*17,theta=n*TAU/branches+(noise(s)-.5)*.6,length=radius*(.75+noise(s+1)*.55)*grow,x=Math.cos(theta)*length,y=Math.sin(theta)*length*.78;
  const flick=.65+noise(s+flicker*3)*.35,twin=!!palette.twin&&n%2===1,body=twin?palette.twin!:palette.mid;
  const main=boltPoints(radius*.08*Math.cos(theta),radius*.08*Math.sin(theta),x,y,7,radius*.1,s+flicker);
  tapered(c,main,palette,(pow?2.6:2.2)+tier*.3,fade*flick,body);
  if((tier>=2||pow)&&!options.low){
   const root=main[3],phi=theta+(noise(s+4)>.5?.65:-.65),sub=length*.42;
   tapered(c,boltPoints(root[0],root[1],root[0]+Math.cos(phi)*sub,root[1]+Math.sin(phi)*sub*.78,4,radius*.06,s+9+flicker),palette,1.3+tier*.15,fade*flick*.85,body);
  }
 }
 // Crackling ring.
 const ring=radius*(.25+grow*.85);c.strokeStyle=palette.mid;c.lineWidth=1.4*(1-age)+.4;c.globalAlpha=.6*fade;c.beginPath();
 for(let n=0;n<=22;n++){const t=n*TAU/22,r=ring*(.82+noise(n+flicker*31)*.18),x=Math.cos(t)*r,y=Math.sin(t)*r*.72;if(!n)c.moveTo(x,y);else c.lineTo(x,y);}c.stroke();
 // Sparks: accent colour from +10, core colour otherwise.
 const sparks=options.low?6:10+tier*4+(pow?6:0);c.lineWidth=1.3;
 for(let n=0;n<sparks;n++){const s=seed+n*5,life=clamp((age-noise(s)*.12)/.88),theta=noise(s+1)*TAU,d=radius*(.2+life*(1.2+noise(s+2)*.8)),x=Math.cos(theta)*d,y=Math.sin(theta)*d*.75+life*life*radius*.5,l=(3+tier)*(1-life);
  c.strokeStyle=n%3===0?palette.core:palette.accent??palette.mid;c.globalAlpha=(1-life)*.9;c.beginPath();c.moveTo(x,y);c.lineTo(x-Math.cos(theta)*l,y-Math.sin(theta)*l*.75);c.stroke();}
 c.restore();
}
