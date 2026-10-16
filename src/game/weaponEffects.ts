import type {Projectile} from '../../shared/protocol';
import {weaponVisualStage} from '../../shared/catalog';

type Effect=Projectile['effect'];
const TAU=Math.PI*2;
const colors:Record<Effect,string[]>={fire:['#9f8771','#edaa61','#ffb74f','#ffcd72'],electric:['#9aadb8','#8ecbdd','#77dafa','#b2f5ff'],crystal:['#aca7b1','#b291d4','#c7a0ef','#eed2ff']};
function strength(level:number){const stage=weaponVisualStage(level);return stage===12?3:stage===10?2:stage===9?1:0;}
function diamond(c:CanvasRenderingContext2D,x:number,y:number,size:number,angle:number,color:string){c.save();c.translate(x,y);c.rotate(angle);c.fillStyle=color;c.beginPath();c.moveTo(0,-size);c.lineTo(size*.43,0);c.lineTo(0,size);c.lineTo(-size*.43,0);c.closePath();c.fill();c.fillStyle='#fff6eb9c';c.beginPath();c.moveTo(0,-size);c.lineTo(0,size);c.lineTo(-size*.43,0);c.closePath();c.fill();c.restore();}

export function drawProjectile(c:CanvasRenderingContext2D,p:Projectile,index:number,level:number,time:number){
 const tier=strength(level),color=colors[p.effect][tier],trail=[5,11,19,29][tier],start=Math.max(0,index-trail),tip=p.points[index];if(!tip)return;
 c.save();c.lineCap='round';c.lineJoin='round';c.strokeStyle=color;c.lineWidth=p.effect==='electric'?1.5+tier*.55:2+tier;c.shadowColor=color;c.shadowBlur=tier*5;
 c.beginPath();for(let j=start;j<=index;j++){const pt=p.points[j];const jitter=p.effect==='electric'&&tier>0&&j!==index?Math.sin(j*12.3+Math.floor(time/40))*tier*2:0;if(j===start)c.moveTo(pt[0],pt[1]);else c.lineTo(pt[0],pt[1]+jitter);}c.stroke();
 if(tier>=2){c.strokeStyle='#fff6d9';c.lineWidth=1;c.shadowBlur=0;c.stroke();}
 const previous=p.points[Math.max(0,index-1)],angle=Math.atan2(tip[1]-previous[1],tip[0]-previous[0]);
 if(p.effect==='crystal'){
  diamond(c,tip[0],tip[1],7+tier*2,angle+Math.PI/2,color);
  if(tier>=2)for(let k=0;k<tier+1;k++){const a=time/180+k*TAU/(tier+1);diamond(c,tip[0]+Math.cos(a)*14,tip[1]+Math.sin(a)*9,2.5,angle,color);}
 }else if(p.effect==='electric'){
  c.save();c.translate(tip[0],tip[1]);c.rotate(angle);c.fillStyle=tier?'#d3f7ff':'#a2afb4';c.strokeStyle='#4b6575';c.lineWidth=1;c.beginPath();c.ellipse(0,0,7+tier,4+tier*.3,0,0,TAU);c.fill();c.stroke();
  if(tier>0){c.strokeStyle=color;c.lineWidth=1.3;for(let n=0;n<tier+1;n++){const a=time/130+n*2.5;c.beginPath();c.moveTo(0,0);c.lineTo(Math.cos(a)*11,Math.sin(a)*8);c.lineTo(Math.cos(a+.25)*17,Math.sin(a+.25)*11);c.stroke();}}c.restore();
 }else{
  c.fillStyle=tier===0?'#77716c':'#fff0ac';c.beginPath();c.arc(tip[0],tip[1],4+tier,0,TAU);c.fill();
  for(let j=start;j<index;j+=tier===0?3:2){const pt=p.points[j],age=(index-j)/trail;c.globalAlpha=(1-age)*(.2+tier*.13);c.fillStyle=tier?'#ed864b':'#b2a69a';c.beginPath();c.arc(pt[0],pt[1]-age*(7+tier*4),2+age*(3+tier*2),0,TAU);c.fill();}
 }
 if(tier===3){c.shadowBlur=4;for(let j=0;j<7;j++){const a=time/250+j*2.399,d=13+Math.sin(time/160+j)*8;c.globalAlpha=.75;c.fillStyle=j%2?'#fff4bf':color;c.beginPath();c.arc(tip[0]+Math.cos(a)*d,tip[1]+Math.sin(a)*d,1+j%2,0,TAU);c.fill();}}
 c.restore();
}

export function drawImpact(c:CanvasRenderingContext2D,p:Projectile,elapsed:number,level:number,material='earth'){
 const tier=strength(level),duration=600+tier*100,a=elapsed/duration;if(a<0||a>=1)return;
 const color=colors[p.effect][tier],x=p.impact.x,y=p.impact.y,radius=p.impact.radius*(.25+a*(tier===3?1.25:.9));
 c.save();c.globalAlpha=(1-a)*.8;c.translate(x,y);c.shadowColor=color;c.shadowBlur=tier*7;
 const glow=c.createRadialGradient(0,0,0,0,0,radius);glow.addColorStop(0,tier?'#fff4ce':'#d5c6b3');glow.addColorStop(.25,color);glow.addColorStop(1,color+'00');c.fillStyle=glow;c.beginPath();c.arc(0,0,radius,0,TAU);c.fill();
 c.shadowBlur=0;c.lineWidth=(tier+2)*(1-a);c.strokeStyle=color;
 if(p.effect==='electric'){
  for(let n=0;n<4+tier*3;n++){const theta=n*TAU/(4+tier*3),r=radius*(.6+(n%3)*.2);c.beginPath();c.moveTo(0,0);c.lineTo(Math.cos(theta+.15)*r*.45,Math.sin(theta+.15)*r*.45);c.lineTo(Math.cos(theta-.1)*r*.7,Math.sin(theta-.1)*r*.7);c.lineTo(Math.cos(theta)*r,Math.sin(theta)*r);c.stroke();}
 }else if(p.effect==='crystal'){
  for(let n=0;n<5+tier*3;n++){const theta=n*2.4,dist=radius*(.6+n%2*.4);diamond(c,Math.cos(theta)*dist,Math.sin(theta)*dist+a*a*30,(5+tier*2)*(1-a),theta,color);}
 }else if(tier>0){
  for(let n=0;n<4+tier*3;n++){const theta=n*2.4,dist=radius*.75;c.save();c.translate(Math.cos(theta)*dist,Math.sin(theta)*dist);c.rotate(theta+Math.PI/2);c.fillStyle=n%2?'#f49349':'#ffcc70';c.beginPath();c.moveTo(0,-radius*.5);c.bezierCurveTo(radius*.3,0,radius*.1,radius*.3,0,radius*.28);c.bezierCurveTo(-radius*.25,radius*.3,-radius*.15,0,0,-radius*.5);c.fill();c.restore();}
 }
 c.beginPath();c.ellipse(0,0,radius,radius*.66,0,0,TAU);c.stroke();
 const debris=material==='metal'?'#d8dcdf':material==='ice'?'#c7efff':material==='sand'?'#dfc487':material==='magic'?'#bba6e4':'#ad8766';
 for(let n=0;n<7+tier*5;n++){const dir=n*2.399,dist=radius*(.65+n%3*.3),px=Math.cos(dir)*dist,py=Math.sin(dir)*dist+a*a*65;c.fillStyle=n%3===0?debris:n%2?'#fff0c3':color;c.save();c.translate(px,py);c.rotate(dir+a*4);c.fillRect(-2,-2,2+(1-a)*3,2+(1-a)*4);c.restore();}
 c.restore();
}

export function drawMuzzle(c:CanvasRenderingContext2D,x:number,y:number,effect:Effect,elapsed:number,level:number,facing:number){
 const a=elapsed/220;if(a<0||a>1)return;const tier=strength(level),r=(9+tier*7)*(1-a);c.save();c.translate(x+27*facing,y-40);c.globalAlpha=1-a;c.fillStyle=colors[effect][tier];c.shadowColor=c.fillStyle;c.shadowBlur=12+tier*4;c.beginPath();for(let n=0;n<12;n++){const angle=n*Math.PI/6,d=n%2?r*.4:r;const px=Math.cos(angle)*d,py=Math.sin(angle)*d;if(n===0)c.moveTo(px,py);else c.lineTo(px,py);}c.closePath();c.fill();c.restore();
}
