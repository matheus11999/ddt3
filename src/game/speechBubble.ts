/**
 * Comic speech bubble drawn in world space: white rounded balloon with a thick dark outline and bold
 * dark text (the game draws the words; no painted text), its tail pointing at the speaker's head.
 * It sits above the head, toward the side the speaker faces; when the map's top edge leaves no room
 * (the queen on her throne), it moves beside the head with a sideways tail. It pops in and fades out.
 */
/** Keeps the balloon below the battle HUD's top band (wind, clock, minimap). */
const HUD_BOTTOM=196,FONT="900 26px 'Nunito', sans-serif",LINE=31,PAD_X=22,PAD_Y=16,MAX_WIDTH=300,RADIUS=24,TAIL=34;

function wrap(c:CanvasRenderingContext2D,text:string){
 const lines:string[]=[];let line='';
 for(const word of text.split(' ')){const next=line?`${line} ${word}`:word;if(line&&c.measureText(next).width>MAX_WIDTH){lines.push(line);line=word;}else line=next;}
 if(line)lines.push(line);return lines;
}

/** `tipX/tipY`: the speaker's head; `age` since it appeared and `left` until it goes, in ms; `worldWidth` keeps it on the map. */
export function drawSpeechBubble(c:CanvasRenderingContext2D,text:string,tipX:number,tipY:number,facing:1|-1,age:number,left:number,worldWidth:number){
 c.save();c.font=FONT;
 const lines=wrap(c,text),w=Math.max(...lines.map(line=>c.measureText(line).width))+PAD_X*2,h=lines.length*LINE+PAD_Y*2;
 const above=tipY-TAIL-h>=HUD_BOTTOM;
 const cx=above?Math.max(w/2+10,Math.min(worldWidth-w/2-10,tipX+facing*(w*.32))):Math.max(w/2+10,Math.min(worldWidth-w/2-10,tipX+facing*(w/2+TAIL+18)));
 const top=above?tipY-TAIL-h:Math.max(HUD_BOTTOM,tipY-h*.7),bottom=top+h,left0=cx-w/2,right0=cx+w/2;
 // Pop with a small overshoot, fade at the end.
 const pop=Math.min(1,age/200),scale=pop<1?.55+.55*pop-.1*Math.sin(Math.PI*pop):1;
 c.globalAlpha*=Math.min(1,left/160,age/80);
 c.translate(tipX,tipY);c.scale(scale,scale);c.translate(-tipX,-tipY);
 c.beginPath();c.moveTo(left0+RADIUS,top);
 if(above){
  const baseX=Math.max(left0+RADIUS+8,Math.min(right0-RADIUS-30,tipX-facing*6));
  c.arcTo(right0,top,right0,bottom,RADIUS);c.arcTo(right0,bottom,left0,bottom,RADIUS);
  c.lineTo(baseX+22,bottom);c.lineTo(tipX,tipY);c.lineTo(baseX,bottom);
  c.arcTo(left0,bottom,left0,top,RADIUS);c.arcTo(left0,top,right0,top,RADIUS);
 }else{
  // Sideways tail from the edge nearest the speaker, low on the balloon, pointing at the mouth.
  const y0=Math.min(bottom-RADIUS-22,Math.max(top+RADIUS*.6,tipY-14));
  if(facing<0){c.arcTo(right0,top,right0,bottom,RADIUS);c.lineTo(right0,y0);c.lineTo(tipX,tipY);c.lineTo(right0,y0+22);c.arcTo(right0,bottom,left0,bottom,RADIUS);c.arcTo(left0,bottom,left0,top,RADIUS);c.arcTo(left0,top,right0,top,RADIUS);}
  else{c.arcTo(right0,top,right0,bottom,RADIUS);c.arcTo(right0,bottom,left0,bottom,RADIUS);c.arcTo(left0,bottom,left0,top,RADIUS);c.lineTo(left0,y0+22);c.lineTo(tipX,tipY);c.lineTo(left0,y0);c.arcTo(left0,top,right0,top,RADIUS);}
 }
 c.closePath();
 c.shadowColor='rgba(0,0,0,.35)';c.shadowOffsetY=4;c.shadowBlur=6;c.fillStyle='#fffdf6';c.fill();
 c.shadowColor='transparent';c.lineJoin='round';c.lineWidth=5;c.strokeStyle='#1d1410';c.stroke();
 c.fillStyle='#1d1410';c.textAlign='center';c.textBaseline='middle';
 lines.forEach((line,index)=>c.fillText(line,cx,top+PAD_Y+LINE*(index+.5)+1));
 c.restore();
}
