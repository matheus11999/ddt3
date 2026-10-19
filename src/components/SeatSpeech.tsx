import {useEffect,useRef,useState} from 'react';
import {useGame} from '../client';
import {bubbleStyle,CHAT_BUBBLE_MS,drawSpeechBubble} from '../game/speechBubble';
import './SeatSpeech.css';

/** The balloon over a room card when that player writes in the Sala chat, drawn like the ones in the plaza and the battle. */
export function SeatSpeech({playerId}:{playerId:string}){
 const {chat,offset}=useGame(),canvas=useRef<HTMLCanvasElement>(null),[,tick]=useState(0);
 const line=[...chat].reverse().find(m=>m.channel==='room'&&m.playerId===playerId);
 const now=Date.now()+offset,live=!!line&&now-line.time<CHAT_BUBBLE_MS;
 useEffect(()=>{
  if(!live||!line)return;const el=canvas.current;if(!el)return;let frame=0;
  const draw=()=>{
   const t=Date.now()+offset,left=line.time+CHAT_BUBBLE_MS-t,box=el.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);
   if(left<=0){tick(n=>n+1);return;}
   const w=Math.max(1,Math.round(box.width*dpr)),h=Math.max(1,Math.round(box.height*dpr));if(el.width!==w||el.height!==h){el.width=w;el.height=h;}
   const c=el.getContext('2d')!;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,w,h);c.scale(dpr,dpr);
   // Sized to the card: a narrow card gets a smaller balloon.
   const scale=Math.min(.62,box.width/420);drawSpeechBubble(c,line.text,box.width*.5,box.height-4,1,t-line.time,left,box.width,{style:bubbleStyle(line.bubble),top:2,scale});
   frame=requestAnimationFrame(draw);
  };
  frame=requestAnimationFrame(draw);return()=>cancelAnimationFrame(frame);
 },[live,line?.id,offset]);
 return live?<canvas ref={canvas} className="seat-speech" data-testid="seat-speech" aria-label={`${line!.name} diz: ${line!.text}`} role="img"/>:null;
}
