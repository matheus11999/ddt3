/**
 * Comic speech bubble drawn in world space: a rounded (or cloud) balloon with a thick outline and bold
 * text (the game draws the words; no painted text), its tail pointing at the speaker's head.
 * It sits above the head, toward the side the speaker faces; when the top edge leaves no room
 * (the queen on her throne), it moves beside the head with a sideways tail. It pops in and fades out.
 * The look comes from the speaker's equipped Bolha (`BUBBLE_STYLES`, the `bubble` slot).
 */
export interface BubbleStyle {shape:'round'|'cloud';/** One colour, or top → bottom. */fill:string|[string,string];stroke:string;text:string;line:number;/** A thin second outline just inside the first. */inner?:string;}
export const BUBBLE_STYLES:Record<string,BubbleStyle>={
 'bubble-none':{shape:'round',fill:'#fffdf6',stroke:'#1d1410',text:'#1d1410',line:5},
 'bubble-cloud':{shape:'cloud',fill:['#ffffff','#d6ecff'],stroke:'#2c5a86',text:'#173a5c',line:4.5},
 'bubble-ember':{shape:'round',fill:['#fff3cc','#ffb04f'],stroke:'#6e2306',text:'#4a1503',line:5,inner:'#fff0b8'},
 'bubble-royal':{shape:'round',fill:['#fffaf0','#f1d9a0'],stroke:'#5e3f0c',text:'#4a3008',line:5,inner:'#d9a93c'},
};
export const bubbleStyle=(id?:string)=>BUBBLE_STYLES[id??'']??BUBBLE_STYLES['bubble-none'];
/** How long a chat line stays over the speaker, in ms. */
export const CHAT_BUBBLE_MS=5000;

/** Keeps the balloon below the battle HUD's top band (wind, clock, minimap). */
const HUD_BOTTOM=196,FONT=26,LINE=31,PAD_X=22,PAD_Y=16,MAX_WIDTH=300,RADIUS=24,TAIL=34;

function wrap(c:CanvasRenderingContext2D,text:string,max:number){
 const lines:string[]=[];let line='';
 for(const word of text.split(' ')){const next=line?`${line} ${word}`:word;if(line&&c.measureText(next).width>max){lines.push(line);line=word;}else line=next;}
 if(line)lines.push(line);return lines.slice(0,4);
}

/** Cloud outline: bumps all round the box. */
function cloudPath(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,bump:number){
 const edge=(x0:number,y0:number,x1:number,y1:number,nx:number,ny:number)=>{
  const n=Math.max(2,Math.round(Math.hypot(x1-x0,y1-y0)/(bump*2.6)));
  for(let i=0;i<n;i++){const a=i/n,b=(i+1)/n,mx=x0+(x1-x0)*(a+b)/2,my=y0+(y1-y0)*(a+b)/2;c.quadraticCurveTo(mx+nx*bump*1.6,my+ny*bump*1.6,x0+(x1-x0)*b,y0+(y1-y0)*b);}
 };
 c.moveTo(x,y);edge(x,y,x+w,y,0,-1);edge(x+w,y,x+w,y+h,1,0);edge(x+w,y+h,x,y+h,0,1);edge(x,y+h,x,y,-1,0);
}

export interface BubbleRect {x:number;y:number;w:number;h:number;}
export interface BubbleOptions {style?:BubbleStyle;/** Balloons already on screen: this one climbs above any it would cover (its tail grows). */avoid?:BubbleRect[];/** Only work out where it goes. */measure?:boolean;/** A top already worked out by a measuring pass. */at?:number;/** Lowest the balloon's top may go (the HUD band above it). */top?:number;/** 1 is the battle size. */scale?:number;}

/** `tipX/tipY`: the speaker's head; `age` since it appeared and `left` until it goes, in ms; `worldWidth` keeps it on the map. */
export function drawSpeechBubble(c:CanvasRenderingContext2D,text:string,tipX:number,tipY:number,facing:1|-1,age:number,left:number,worldWidth:number,options:BubbleOptions={}):BubbleRect{
 const style=options.style??BUBBLE_STYLES['bubble-none'],k=options.scale??1,limit=options.top??HUD_BOTTOM;
 const line=LINE*k,padX=PAD_X*k,padY=PAD_Y*k,radius=RADIUS*k,tail=TAIL*k,cloud=style.shape==='cloud',bump=8*k;
 c.save();c.font=`900 ${FONT*k}px 'Nunito', sans-serif`;
 const lines=wrap(c,text,MAX_WIDTH*k),w=Math.max(...lines.map(l=>c.measureText(l).width))+padX*2+(cloud?bump*2:0),h=lines.length*line+padY*2+(cloud?bump:0);
 const above=tipY-tail-h>=limit,margin=10*k+(cloud?bump*1.6:0);
 const cx=above?Math.max(w/2+margin,Math.min(worldWidth-w/2-margin,tipX+facing*(w*.32))):Math.max(w/2+margin,Math.min(worldWidth-w/2-margin,tipX+facing*(w/2+tail+18*k)));
 let top=options.at??(above?tipY-tail-h:Math.max(limit,tipY-h*.7));const left0=cx-w/2,right0=cx+w/2;
 for(let moved=true,guard=0;moved&&guard<8;guard++){moved=false;for(const r of options.avoid??[])if(left0<r.x+r.w&&right0>r.x&&top<r.y+r.h&&top+h>r.y){top=r.y-h-4*k;moved=true;}}
 const bottom=top+h,rect={x:left0,y:top,w,h};
 if(options.measure){c.restore();return rect;}
 // Pop with a small overshoot, fade at the end.
 const pop=Math.min(1,age/200),scale=pop<1?.55+.55*pop-.1*Math.sin(Math.PI*pop):1;
 c.globalAlpha*=Math.max(0,Math.min(1,left/160,age/80));
 c.translate(tipX,tipY);c.scale(scale,scale);c.translate(-tipX,-tipY);
 const outline=()=>{
  c.beginPath();
  if(cloud){cloudPath(c,left0,top,w,h,bump);c.closePath();return;}
  c.moveTo(left0+radius,top);
  if(above){
   const baseX=Math.max(left0+radius+8*k,Math.min(right0-radius-30*k,tipX-facing*6*k));
   c.arcTo(right0,top,right0,bottom,radius);c.arcTo(right0,bottom,left0,bottom,radius);
   c.lineTo(baseX+22*k,bottom);c.lineTo(tipX,tipY);c.lineTo(baseX,bottom);
   c.arcTo(left0,bottom,left0,top,radius);c.arcTo(left0,top,right0,top,radius);
  }else{
   // Sideways tail from the edge nearest the speaker, low on the balloon, pointing at the mouth.
   const y0=Math.min(bottom-radius-22*k,Math.max(top+radius*.6,tipY-14*k));
   if(facing<0){c.arcTo(right0,top,right0,bottom,radius);c.lineTo(right0,y0);c.lineTo(tipX,tipY);c.lineTo(right0,y0+22*k);c.arcTo(right0,bottom,left0,bottom,radius);c.arcTo(left0,bottom,left0,top,radius);c.arcTo(left0,top,right0,top,radius);}
   else{c.arcTo(right0,top,right0,bottom,radius);c.arcTo(right0,bottom,left0,bottom,radius);c.arcTo(left0,bottom,left0,top,radius);c.lineTo(left0,y0+22*k);c.lineTo(tipX,tipY);c.lineTo(left0,y0);c.arcTo(left0,top,right0,top,radius);}
  }
  c.closePath();
 };
 let fill:string|CanvasGradient=typeof style.fill==='string'?style.fill:'';
 if(typeof style.fill!=='string'){const g=c.createLinearGradient(0,top,0,bottom);g.addColorStop(0,style.fill[0]);g.addColorStop(1,style.fill[1]);fill=g;}
 // A cloud's tail is a trail of little puffs toward the speaker, as in a thought balloon.
 const puffs=cloud?[.38,.68].map((f,i)=>{const sx=above?Math.max(left0+w*.25,Math.min(right0-w*.25,tipX+facing*w*.12)):facing<0?right0:left0,sy=above?bottom:Math.min(bottom-bump,Math.max(top+bump,tipY));return {x:sx+(tipX-sx)*f,y:sy+(tipY-sy)*f+(above?bump*.6:0),r:(i?5:8)*k};}):[];
 c.lineJoin='round';
 for(const p of puffs){c.beginPath();c.arc(p.x,p.y,p.r,0,Math.PI*2);c.fillStyle=fill;c.fill();c.lineWidth=style.line*.8*k;c.strokeStyle=style.stroke;c.stroke();}
 outline();
 c.shadowColor='rgba(0,0,0,.35)';c.shadowOffsetY=4*k;c.shadowBlur=6*k;c.fillStyle=fill;c.fill();
 c.shadowColor='transparent';c.lineWidth=style.line*k;c.strokeStyle=style.stroke;c.stroke();
 if(style.inner){c.save();outline();c.clip();outline();c.lineWidth=style.line*1.9*k;c.strokeStyle=style.inner;c.globalAlpha*=.9;c.stroke();c.lineWidth=style.line*k*.9;c.strokeStyle=style.stroke;c.stroke();c.restore();}
 c.fillStyle=style.text;c.textAlign='center';c.textBaseline='middle';
 const textTop=top+padY+(cloud?bump/2:0);
 lines.forEach((l,index)=>c.fillText(l,cx,textTop+line*(index+.5)+1*k));
 c.restore();return rect;
}

export interface SpeechLine {text:string;tipX:number;tipY:number;facing:1|-1;age:number;left:number;options:BubbleOptions;}
/** Several balloons at once, oldest first: a newer one climbs above those it would cover, and the newer
 * (higher) ones are drawn first so the lower balloons sit over their longer tails. */
export function drawSpeechBubbles(c:CanvasRenderingContext2D,lines:SpeechLine[],worldWidth:number){
 const taken:BubbleRect[]=[],tops=lines.map(l=>{const r=drawSpeechBubble(c,l.text,l.tipX,l.tipY,l.facing,l.age,l.left,worldWidth,{...l.options,avoid:taken,measure:true});taken.push(r);return r.y;});
 for(let i=lines.length-1;i>=0;i--){const l=lines[i];drawSpeechBubble(c,l.text,l.tipX,l.tipY,l.facing,l.age,l.left,worldWidth,{...l.options,at:tops[i]});}
}
