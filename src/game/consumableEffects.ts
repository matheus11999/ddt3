import type {Projectile} from '../../shared/protocol';
import {audio} from './audio';

/**
 * Enfurecer and Gelo in the arena (docs/consumables.md). Paintings by Codex, cut by
 * scripts/build-consumables-art.py; sounds are the DDTank reference cues (023 ice launch,
 * 093 ice impact). Using a tool plays the game's default tool cue (matheus rejected 039).
 */
const ART={rage:'/assets/consumables/rage-icon.png',ice:'/assets/consumables/ice-icon.png',ball:'/assets/consumables/ice-projectile.png',impact:'/assets/consumables/ice-impact.png',block:'/assets/consumables/ice-block.png'} as const;
export const CONSUMABLE_SOUNDS={fire:'/assets/audio/consumables/ice-fire.mp3',impact:'/assets/audio/consumables/ice-impact.mp3'} as const;
const images=new Map<keyof typeof ART,HTMLImageElement>();
/** Impact strip: 7 frames of 256 px; block strip: intact, cracked, shattering (320 px). */
const IMPACT_FRAMES=7,IMPACT_FRAME_MS=80,BLOCK_SIZE=320,IMPACT_SIZE=256;
export const ICE_IMPACT_DURATION=IMPACT_FRAMES*IMPACT_FRAME_MS;
export const ICE_SHATTER_DURATION=520;
export const ICE_FORM_DURATION=320;
export const CONSUMABLE_ICON_DURATION=1200;
const clamp=(v:number,lo=0,hi=1)=>Math.min(hi,Math.max(lo,v));

export function preloadConsumables(){
 if(typeof Image==='undefined')return;
 for(const [key,src] of Object.entries(ART) as [keyof typeof ART,string][]){if(images.has(key))continue;const image=new Image();image.onload=()=>images.set(key,image);image.src=src;}
 audio.preload(Object.values(CONSUMABLE_SOUNDS));
}
if(typeof Image!=='undefined')preloadConsumables();
export function playConsumableSound(id:keyof typeof CONSUMABLE_SOUNDS){audio.playFile(CONSUMABLE_SOUNDS[id],.8);}

/** The ice ball along the server path, turned to its velocity (DDTank SimpleBomb rotates by the speed angle). */
export function drawIceProjectile(c:CanvasRenderingContext2D,p:Projectile,index:number){
 const ball=images.get('ball');if(!ball||!p.points.length||!Number.isFinite(index))return;
 const sample=clamp(index,0,p.points.length-1),i=Math.floor(sample),a=p.points[i],b=p.points[Math.min(i+1,p.points.length-1)],f=sample-i,x=a[0]+(b[0]-a[0])*f,y=a[1]+(b[1]-a[1])*f;
 const back=p.points[Math.max(0,i-1)],angle=Math.atan2(b[1]-back[1],b[0]-back[0]);
 // The painted ball faces right with its frost tail behind; its round head sits right of the cell centre.
 c.save();c.translate(x,y);c.rotate(angle);c.drawImage(ball,-43,-34,64,64);c.restore();
}
/** Ice burst where the ball landed: 7 painted frames, no crater (Ball1 has none). */
export function drawIceImpact(c:CanvasRenderingContext2D,x:number,y:number,age:number){
 const sheet=images.get('impact');if(!sheet||age<0||age>=ICE_IMPACT_DURATION)return;
 const frame=Math.min(IMPACT_FRAMES-1,Math.floor(age/IMPACT_FRAME_MS)),size=190;
 c.drawImage(sheet,frame*IMPACT_SIZE,0,IMPACT_SIZE,IMPACT_SIZE,x-size/2,y-size*.6,size,size);
}
/**
 * The ice that encases a frozen fighter, over the avatar (feet at x,y). It grows out of the ground when it
 * forms, shows cracks on the last frozen turn, and bursts when it thaws or an attack breaks it.
 */
export function drawFrozenBlock(c:CanvasRenderingContext2D,x:number,y:number,state:{since:number;turns:number;thawAt?:number},now:number){
 const block=images.get('block');if(!block)return;
 const size=190,top=y-size*.88;
 if(state.thawAt!==undefined){
  const t=(now-state.thawAt)/ICE_SHATTER_DURATION;if(t>=1)return;
  c.save();c.globalAlpha*=1-t*t;const grow=1+t*.18;c.translate(x,y);c.scale(grow,grow);c.drawImage(block,2*BLOCK_SIZE,0,BLOCK_SIZE,BLOCK_SIZE,-size/2,-size*.88,size,size);c.restore();return;
 }
 const form=clamp((now-state.since)/ICE_FORM_DURATION),rise=1-Math.pow(1-form,3),shimmer=.7+Math.sin(now/420)*.04;
 c.save();c.globalAlpha*=shimmer*(.4+.6*form);
 // Grows upward from the feet: clip the painting to the risen height.
 c.beginPath();c.rect(x-size,y-size*rise-4,size*2,size*rise+8);c.clip();
 c.drawImage(block,(state.turns<=1?1:0)*BLOCK_SIZE,0,BLOCK_SIZE,BLOCK_SIZE,x-size/2,top,size,size);c.restore();
}
/** The tool's icon over the head when it is used (DDTank AutoPropEffect: 60×60 at (-5,-140), fading). */
export function drawConsumableIcon(c:CanvasRenderingContext2D,id:'rage'|'ice',x:number,y:number,age:number){
 const icon=images.get(id);if(!icon||age<0||age>=CONSUMABLE_ICON_DURATION)return;
 const t=age/CONSUMABLE_ICON_DURATION,alpha=clamp(t/.12)*(t<.6?1:1-(t-.6)/.4),pop=t<.15?.7+.3*(t/.15):1;
 c.save();c.globalAlpha*=alpha;c.translate(x-5,y-140-t*16);c.scale(pop,pop);c.drawImage(icon,-30,-30,60,60);c.restore();
}
