// Blinks and pain faces drawn over any painted face, as in DDTank. Every face shares the universal
// head registration (faces.ts), so the eyes and mouth always sit at the same sockets: the overlay
// paints the bald base head back over them and inks the new eyes and mouth in that place.
export type FaceState='blink'|'hurt'|'critical';

type Eye={x:number;y:number;rx:number;ry:number;side:-1|1};
/** Atlas coordinates (1254 px head template). The near eye is on the left, the far eye on the right. */
const EYES:readonly Eye[]=[{x:647,y:441,rx:64,ry:52,side:-1},{x:791,y:468,rx:30,ry:42,side:1}];
const MOUTH={x:713,y:538,rx:48,ry:32};
/** Region of the atlas the overlay covers. */
export const FACE_OVERLAY_RECT=[560,370,290,210] as const;
const INK='#3b160c',LINE=15;

/** Blink about every 3–5 s for 130 ms, with each fighter on its own rhythm. */
export function blinking(time:number,seed:number){
 const period=3000+(seed%2000),phase=(time+seed*7919)%period;
 return phase<130||(seed%3===0&&phase>260&&phase<360);
}
/** Pain face after a hit: a normal hit flinches briefly, a critical stuns for longer. */
export const HURT_FACE_MS=650,CRITICAL_FACE_MS=1400;
export function hitFace(age:number,critical:boolean):FaceState|undefined{
 if(!Number.isFinite(age)||age<0)return undefined;
 return age<(critical?CRITICAL_FACE_MS:HURT_FACE_MS)?(critical?'critical':'hurt'):undefined;
}
export function hashSeed(id:string){let h=0;for(let i=0;i<id.length;i++)h=(h*31+id.charCodeAt(i))>>>0;return h%100000;}

const cache=new Map<string,HTMLCanvasElement|null>();
/** Faces painted with an eye already closed (wink, happy arcs) keep that eye during a blink. */
function openEyes(face:HTMLCanvasElement){
 const c=face.getContext('2d',{willReadFrequently:true})!,sx=face.width/1254;
 return EYES.map(eye=>{
  const x0=Math.round((eye.x-eye.rx)*sx),y0=Math.round((eye.y-eye.ry)*sx),w=Math.round(eye.rx*2*sx),h=Math.round(eye.ry*2*sx);
  const data=c.getImageData(x0,y0,w,h).data;let white=0,inside=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const dx=(x+.5)/w*2-1,dy=(y+.5)/h*2-1;if(dx*dx+dy*dy>1)continue;inside++;
   const i=(y*w+x)*4;if(data[i+3]>200&&data[i]>225&&data[i+1]>225&&data[i+2]>225)white++;
  }
  return white>inside*.03;
 });
}
function cover(c:CanvasRenderingContext2D,base:HTMLImageElement,x:number,y:number,rx:number,ry:number){
 const [ox,oy,w,h]=FACE_OVERLAY_RECT,mask=document.createElement('canvas');mask.width=w;mask.height=h;
 const m=mask.getContext('2d')!;m.drawImage(base,ox,oy,w,h,0,0,w,h);
 m.globalCompositeOperation='destination-in';m.translate(x-ox,y-oy);m.scale(1,ry/rx);
 const g=m.createRadialGradient(0,0,rx*.78,0,0,rx*1.08);g.addColorStop(0,'#fff');g.addColorStop(1,'#fff0');
 m.fillStyle=g;m.fillRect(-rx*2,-rx*2,rx*4,rx*4);
 c.drawImage(mask,0,0);
}
function stroke(c:CanvasRenderingContext2D,width=LINE){c.strokeStyle=INK;c.lineWidth=width;c.lineCap=c.lineJoin='round';c.stroke();}
/** Closed lid: a soft downward curve with a flick of lashes at the outer corner. */
function closedEye(c:CanvasRenderingContext2D,e:Eye){
 const l=e.x-e.rx*.85,r=e.x+e.rx*.85,y=e.y+e.ry*.12;
 c.beginPath();c.moveTo(l,y);c.quadraticCurveTo(e.x,y+e.ry*.42,r,y);stroke(c);
 const outer=e.side<0?l:r;c.beginPath();c.moveTo(outer,y);c.lineTo(outer+e.side*e.rx*.28,y-e.ry*.22);stroke(c,LINE*.8);
}
/** Squeezed shut, the ">" "<" flinch: both strokes point to the nose. */
function squeezedEye(c:CanvasRenderingContext2D,e:Eye){
 const tip=e.x-e.side*e.rx*.45,back=e.x+e.side*e.rx*.7;
 c.beginPath();c.moveTo(back,e.y-e.ry*.5);c.lineTo(tip,e.y+e.ry*.05);c.lineTo(back,e.y+e.ry*.5);stroke(c,LINE*1.1);
}
/** Dazed spiral eyes for a critical hit. */
function spiralEye(c:CanvasRenderingContext2D,e:Eye){
 c.beginPath();const small=e.rx<45,turns=small?1.4:2.2,steps=60;
 for(let i=0;i<=steps;i++){const t=i/steps,a=t*turns*Math.PI*2,r=t*.85;const x=e.x+Math.cos(a)*e.rx*r,y=e.y+e.ry*.05+Math.sin(a)*e.ry*r;if(i)c.lineTo(x,y);else c.moveTo(x,y);}
 stroke(c,LINE*(small?.6:.85));
}
function painMouth(c:CanvasRenderingContext2D,wide:boolean){
 const {x,y}=MOUTH,w=wide?30:24,h=wide?22:13;
 c.beginPath();c.moveTo(x-w,y-h*.35);c.quadraticCurveTo(x,y-h*.9,x+w,y-h*.35);c.quadraticCurveTo(x+w*.7,y+h,x,y+h);c.quadraticCurveTo(x-w*.7,y+h,x-w,y-h*.35);c.closePath();
 c.fillStyle='#6b1f17';c.fill();stroke(c,LINE*.75);
 c.save();c.clip();c.fillStyle='#d9675c';c.beginPath();c.ellipse(x+w*.15,y+h*.95,w*.55,h*.5,0,0,Math.PI*2);c.fill();
 c.fillStyle='#fff6ee';c.fillRect(x-w,y-h*1.2,w*2,h*.62);c.restore();
}

/** The overlay for one face and state, in the coordinates of FACE_OVERLAY_RECT. Null when nothing changes. */
export function faceOverlay(faceId:string,state:FaceState,base:HTMLImageElement,face:HTMLCanvasElement):HTMLCanvasElement|null{
 const key=`${faceId}:${state}`;if(cache.has(key))return cache.get(key)!;
 const [ox,oy,w,h]=FACE_OVERLAY_RECT,out=document.createElement('canvas');out.width=w;out.height=h;
 const c=out.getContext('2d')!,open=state==='blink'?openEyes(face):[true,true];
 EYES.forEach((eye,i)=>{if(open[i])cover(c,base,eye.x,eye.y,eye.rx,eye.ry);});
 if(state!=='blink')cover(c,base,MOUTH.x,MOUTH.y,MOUTH.rx,MOUTH.ry);
 c.translate(-ox,-oy);
 EYES.forEach((eye,i)=>{if(!open[i])return;if(state==='blink')closedEye(c,eye);else if(state==='hurt')squeezedEye(c,eye);else spiralEye(c,eye);});
 if(state!=='blink')painMouth(c,state==='critical');
 const result=open.some(Boolean)||state!=='blink'?out:null;cache.set(key,result);return result;
}
export function clearFaceOverlays(){cache.clear();}

/** Now and then a resting head tilts or glances briefly, so the fighter feels alive. Radians. */
export function idleHeadTilt(time:number,seed:number){
 const period=5200+(seed%3100),phase=(time+seed*4513)%period,move=1500;
 if(phase>move)return 0;
 const cycle=Math.floor((time+seed*4513)/period),direction=(seed+cycle)%2?1:-1,amount=.05+((seed*7+cycle*13)%5)*.008;
 return direction*amount*Math.sin(Math.PI*phase/move)**2;
}
