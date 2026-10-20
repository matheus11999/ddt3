import {useEffect,useRef,useState} from 'react';
import {FISH_BY_ID} from '../../shared/fishing';
import {drawFish} from '../game/fishingWorld';

/** Painted icon files, once known to exist (docs/fishing-art-prompts.md); until then the drawn stand-in. */
const known=new Map<string,boolean>();
function usePainted(src:string){
 const [ok,setOk]=useState(known.get(src)??false);
 useEffect(()=>{if(known.has(src)){setOk(known.get(src)!);return;}const image=new Image();image.onload=()=>{known.set(src,true);setOk(true);};image.onerror=()=>known.set(src,false);image.src=src;},[src]);
 return ok;
}
/** Icon of a fish, rod, bait, Pontos de Pesca or a fishing-shop prize. */
export function FishingIcon({id,size=48,unknown=false}:{id:string;size?:number;unknown?:boolean}){
 const src=`/assets/fishing/icons/${id}.png`,painted=usePainted(src),canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  if(painted&&!unknown)return;const c=canvas.current?.getContext('2d');if(!c)return;
  const d=2;c.setTransform(d,0,0,d,0,0);c.clearRect(0,0,size,size);
  if(unknown)c.filter='brightness(0) opacity(.35)';
  if(FISH_BY_ID.has(id))drawFish(c,id,size/2,size/2,size*.92,-.25);
  else if(id.startsWith('rod-'))drawRod(c,size,id==='rod-oak'?'#7a4a24':'#c9a35a');
  else if(id.startsWith('bait-'))drawBait(c,size,id==='bait-glow');
  else drawCoin(c,size);
  c.filter='none';
 },[id,size,painted,unknown]);
 if(painted&&!unknown)return <img className="fishing-icon" src={src} alt="" width={size} height={size} draggable={false}/>;
 return <canvas className="fishing-icon" ref={canvas} width={size*2} height={size*2} style={{width:size,height:size}}/>;
}
function drawRod(c:CanvasRenderingContext2D,s:number,wood:string){
 c.lineCap='round';c.strokeStyle='#3a2410';c.lineWidth=s*.11;c.beginPath();c.moveTo(s*.2,s*.84);c.lineTo(s*.84,s*.14);c.stroke();
 c.strokeStyle=wood;c.lineWidth=s*.06;c.beginPath();c.moveTo(s*.2,s*.84);c.lineTo(s*.84,s*.14);c.stroke();
 c.fillStyle='#2b2b38';c.beginPath();c.arc(s*.32,s*.71,s*.09,0,Math.PI*2);c.fill();c.fillStyle='#9aa0b8';c.beginPath();c.arc(s*.32,s*.71,s*.04,0,Math.PI*2);c.fill();
 c.strokeStyle='rgba(255,255,255,.9)';c.lineWidth=1;c.beginPath();c.moveTo(s*.84,s*.14);c.quadraticCurveTo(s*.9,s*.5,s*.8,s*.72);c.stroke();
 c.fillStyle='#e8433a';c.beginPath();c.arc(s*.8,s*.76,s*.06,0,Math.PI*2);c.fill();
}
function drawBait(c:CanvasRenderingContext2D,s:number,glow:boolean){
 if(glow){const g=c.createRadialGradient(s/2,s/2,0,s/2,s/2,s*.48);g.addColorStop(0,'rgba(255,240,140,.9)');g.addColorStop(1,'rgba(255,200,60,0)');c.fillStyle=g;c.fillRect(0,0,s,s);}
 c.lineCap='round';c.strokeStyle=glow?'#ffb020':'#d86a7a';c.lineWidth=s*.16;c.beginPath();c.moveTo(s*.22,s*.6);c.bezierCurveTo(s*.34,s*.28,s*.5,s*.82,s*.62,s*.46);c.quadraticCurveTo(s*.7,s*.24,s*.8,s*.36);c.stroke();
 c.strokeStyle='rgba(255,255,255,.5)';c.lineWidth=s*.04;c.beginPath();c.moveTo(s*.3,s*.46);c.lineTo(s*.34,s*.52);c.moveTo(s*.52,s*.6);c.lineTo(s*.56,s*.56);c.stroke();
}
function drawCoin(c:CanvasRenderingContext2D,s:number){
 const g=c.createRadialGradient(s*.4,s*.35,s*.05,s/2,s/2,s*.45);g.addColorStop(0,'#c8f4ff');g.addColorStop(.6,'#34a9e0');g.addColorStop(1,'#1a5f9a');
 c.fillStyle=g;c.strokeStyle='#0e3a66';c.lineWidth=s*.06;c.beginPath();c.arc(s/2,s/2,s*.42,0,Math.PI*2);c.fill();c.stroke();
 drawFish(c,'lambari-dourado',s/2,s/2,s*.5,0);
}
