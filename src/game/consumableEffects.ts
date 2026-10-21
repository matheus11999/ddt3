import type {Projectile} from '../../shared/protocol';
import {BOOSTS,type BoostId} from '../../shared/catalog';
import {audio} from './audio';
import {freeImage} from './spriteCache';

/**
 * Enfurecer and Gelo in the arena (docs/consumables.md). Paintings by Codex, cut by
 * scripts/build-consumables-art.py; sounds are the DDTank reference cues (023 ice launch,
 * 093 ice impact). Using a tool plays the game's default tool cue (matheus rejected 039).
 */
const ART={rage:'/assets/consumables/rage-icon.png',ice:'/assets/consumables/ice-icon.png',ball:'/assets/consumables/ice-projectile.png',impact:'/assets/consumables/ice-impact.png',block:'/assets/consumables/ice-block.png'} as const;
export const CONSUMABLE_SOUNDS={fire:'/assets/audio/consumables/ice-fire.mp3',impact:'/assets/audio/consumables/ice-impact.mp3'} as const;
const files=new Map<keyof typeof ART,HTMLImageElement>();
/** A painting once loaded; asks for it the first time (battle-only art: the loading screen warms it, `releaseConsumables` lets it go). */
const images={get(key:keyof typeof ART){let image=files.get(key);if(!image){if(typeof Image==='undefined')return undefined;image=new Image();image.decoding='async';image.src=ART[key];files.set(key,image);}return image.complete&&image.naturalWidth?image:undefined;}};
/** Impact strip: 7 frames of 256 px; block strip: intact, cracked, shattering (320 px). */
const IMPACT_FRAMES=7,IMPACT_FRAME_MS=80,BLOCK_SIZE=320,IMPACT_SIZE=256;
export const ICE_IMPACT_DURATION=IMPACT_FRAMES*IMPACT_FRAME_MS;
export const ICE_SHATTER_DURATION=520;
export const ICE_FORM_DURATION=320;
const clamp=(v:number,lo=0,hi=1)=>Math.min(hi,Math.max(lo,v));

/** Warms the paintings and sounds (the loading screen awaits the images). */
export function preloadConsumables():HTMLImageElement[]{
 if(typeof Image==='undefined')return [];
 for(const key of Object.keys(ART) as (keyof typeof ART)[])images.get(key);
 audio.preload(Object.values(CONSUMABLE_SOUNDS));
 return [...files.values()];
}
export function releaseConsumables(){for(const image of files.values())freeImage(image);files.clear();}
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
 // Wide and low like the fighter lying down (matheus 20/10: the 190 px square was too tall), see-through enough to show them inside.
 const width=180,height=130,top=y-height*.88;
 if(state.thawAt!==undefined){
  const t=(now-state.thawAt)/ICE_SHATTER_DURATION;if(t>=1)return;
  c.save();c.globalAlpha*=1-t*t;const grow=1+t*.18;c.translate(x,y);c.scale(grow,grow);c.drawImage(block,2*BLOCK_SIZE,0,BLOCK_SIZE,BLOCK_SIZE,-width/2,-height*.88,width,height);c.restore();return;
 }
 const form=clamp((now-state.since)/ICE_FORM_DURATION),rise=1-Math.pow(1-form,3),shimmer=.46+Math.sin(now/420)*.04;
 c.save();c.globalAlpha*=shimmer*(.4+.6*form);
 // Grows upward from the feet: clip the painting to the risen height.
 c.beginPath();c.rect(x-width,y-height*rise-4,width*2,height*rise+8);c.clip();
 c.drawImage(block,(state.turns<=1?1:0)*BLOCK_SIZE,0,BLOCK_SIZE,BLOCK_SIZE,x-width/2,top,width,height);c.restore();
}
/**
 * Using a battle item or power-up (DDTank ghostPcikPropAsset + AutoPropEffect, studied 21/10/2026): a quick warm
 * flash on the body with a few golden motes, then the item's icon rises over the head on a soft golden halo
 * that widens and fades at the end. Small and discreet (matheus prefers simple effects); the reference's gesture
 * has no painted pose here, so the body keeps its own. No sound of its own: the tool cue already plays.
 */
export type ItemUse=BoostId|'heal'|'homing'|'invisibility';
export const ITEM_USE_DURATION=2200;
const BOOST_ATLAS='/assets/ui/boost-arrows-power.png',ABILITY_ICON=(id:string)=>`/assets/abilities/${id}.png`;
const useImages=new Map<string,HTMLImageElement>();
function useImage(src:string){let image=useImages.get(src);if(!image){if(typeof Image==='undefined')return undefined;image=new Image();image.decoding='async';image.src=src;useImages.set(src,image);}return image.complete&&image.naturalWidth?image:undefined;}
export function preloadItemUse():HTMLImageElement[]{
 if(typeof Image==='undefined')return [];
 useImage(BOOST_ATLAS);for(const id of ['heal','homing','invisibility'])useImage(ABILITY_ICON(id));
 return [...useImages.values()];
}
const cards=new Map<ItemUse,HTMLCanvasElement>();let halo:HTMLCanvasElement|null=null;
export function releaseItemUse(){for(const image of useImages.values())freeImage(image);useImages.clear();cards.clear();halo=null;}
const CARD=66,CARD_PX=2;
/** The icon as the power bar shows it (painting + the number the game draws), drawn once into a small canvas. */
function itemCard(id:ItemUse):HTMLCanvasElement|undefined{
 const cached=cards.get(id);if(cached)return cached;
 const index=BOOSTS.findIndex(boost=>boost.id===id),own=id==='rage'||id==='ice'?images.get(id):index<0?useImage(ABILITY_ICON(id)):undefined,atlas=index>=0&&!own?useImage(BOOST_ATLAS):undefined;
 if(!own&&!atlas)return undefined;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=CARD*CARD_PX;const c=canvas.getContext('2d')!;c.scale(CARD_PX,CARD_PX);
 c.save();c.shadowColor='#030919a0';c.shadowOffsetY=2;c.shadowBlur=2;
 if(own)c.drawImage(own,1,1,CARD-2,CARD-2);
 else if(atlas){const w=atlas.naturalWidth/4,h=atlas.naturalHeight/2;c.drawImage(atlas,(index%4)*w,Math.floor(index/4)*h,w,h,1,1,CARD-2,CARD-2);}
 c.restore();
 // Same numbers as the power bar (BattleHud.css .boost-symbol-label).
 const label=(text:string,size:number,x:number,y:number,align:CanvasTextAlign,fill:string,shade:string,italic=false)=>{
  c.font=`${italic?'italic ':''}900 ${size}px Nunito, sans-serif`;c.textAlign=align;c.textBaseline='alphabetic';c.lineJoin='round';
  c.fillStyle=shade;c.fillText(text,x+1,y+2);c.strokeStyle='#fff4c3';c.lineWidth=size/10;c.strokeText(text,x,y);c.fillStyle=fill;c.fillText(text,x,y);
 };
 const boost=BOOSTS[index];
 if(id==='rage'){label('+50',27,CARD/2,CARD-6,'center','#f33520','#8b2426');label('POW',9.5,CARD/2,24,'center','#fff3a5','#382331',true);}
 else if(id==='extra1'||id==='extra2')label(boost.label,25,CARD-4,CARD-6,'right','#f33520','#8b2426',true);
 else if(id==='trident')label('×3',25,CARD-4,CARD-6,'right','#168eff','#103f96',true);
 else if(id.startsWith('damage')){label(boost.label,27,CARD/2,CARD-6,'center','#f33520','#8b2426');label('POWER',9.5,CARD/2,24,'center','#fff3a5','#382331',true);}
 cards.set(id,canvas);return canvas;
}
/** Soft golden halo with fuzzy rays, painted once (never a hard ring or a filter each frame). */
function haloArt():HTMLCanvasElement{
 if(halo)return halo;
 const size=160,r=size/2,canvas=document.createElement('canvas');canvas.width=canvas.height=size;const c=canvas.getContext('2d')!;
 const glow=c.createRadialGradient(r,r,r*.18,r,r,r*.62);glow.addColorStop(0,'rgba(255,236,150,0)');glow.addColorStop(.55,'rgba(255,214,90,.55)');glow.addColorStop(1,'rgba(255,170,40,0)');
 c.fillStyle=glow;c.beginPath();c.arc(r,r,r*.62,0,Math.PI*2);c.fill();
 c.globalCompositeOperation='lighter';c.lineCap='round';
 for(let i=0;i<70;i++){
  const a=i/70*Math.PI*2+Math.sin(i*12.9)*.04,inner=r*(.34+((i*37)%7)/70),outer=r*(.6+((i*53)%11)/36),x0=r+Math.cos(a)*inner,y0=r+Math.sin(a)*inner,x1=r+Math.cos(a)*outer,y1=r+Math.sin(a)*outer;
  const ray=c.createLinearGradient(x0,y0,x1,y1);ray.addColorStop(0,'rgba(255,226,120,0)');ray.addColorStop(.4,'rgba(255,214,90,.42)');ray.addColorStop(1,'rgba(255,180,50,0)');
  c.strokeStyle=ray;c.lineWidth=1.2+(i%3)*.5;c.beginPath();c.moveTo(x0,y0);c.lineTo(x1,y1);c.stroke();
 }
 return halo=canvas;
}
const easeOut=(t:number)=>1-Math.pow(1-clamp(t),3);
/** Where the icon sits over the feet: above the name, HP bar and turn mark, which are drawn after the fighters. */
const ICON_RISE=192;
/**
 * The fighter's part (feet at x,y): body flash, motes and the glow flying up, drawn with the fighter. The icon and
 * its halo are drawn after the name plates (`layer` 'icon'), so the plate never covers them.
 */
export function drawItemUse(c:CanvasRenderingContext2D,id:ItemUse,x:number,y:number,age:number,layer:'body'|'icon'){
 if(age<0||age>=ITEM_USE_DURATION)return;
 const cx=x,cy=y-24,iconY=y-ICON_RISE;
 if(layer==='body'){
  c.save();c.globalCompositeOperation='lighter';
  // Warm flash on the body: up fast, gone by 420 ms.
  if(age<420){
   const k=age/420,a=(k<.25?k/.25:1-(k-.25)/.75)*.62,r=20+easeOut(k)*16,flash=c.createRadialGradient(cx,cy,0,cx,cy,r);
   flash.addColorStop(0,`rgba(255,250,225,${a})`);flash.addColorStop(.5,`rgba(255,215,120,${a*.6})`);flash.addColorStop(1,'rgba(255,170,60,0)');
   c.fillStyle=flash;c.beginPath();c.arc(cx,cy,r,0,Math.PI*2);c.fill();
  }
  // A few golden motes burst out and slow down.
  if(age>=100&&age<760){
   const k=(age-100)/660,d=easeOut(k);
   for(let i=0;i<7;i++){const a=i/7*Math.PI*2+.4,dist=14+d*(18+(i*13)%12);c.fillStyle=`rgba(255,${200+(i*17)%40},110,${(1-k)*.9})`;c.beginPath();c.arc(cx+Math.cos(a)*dist,cy+Math.sin(a)*dist*.7-d*6,1.6+(i%3)*.5,0,Math.PI*2);c.fill();}
  }
  // A small glow flies from the body up to where the icon appears.
  if(age>=140&&age<520){
   const k=easeOut((age-140)/380),gy=cy+(iconY-cy)*k,a=(1-k*.6)*.7,mote=c.createRadialGradient(cx,gy,0,cx,gy,9);
   mote.addColorStop(0,`rgba(255,245,200,${a})`);mote.addColorStop(1,'rgba(255,190,70,0)');c.fillStyle=mote;c.beginPath();c.arc(cx,gy,9,0,Math.PI*2);c.fill();
  }
  c.restore();return;
 }
 if(age<460)return;
 // Icon on its halo: pops in, breathes, then the halo widens and both fade.
 const t=age-460,span=ITEM_USE_DURATION-460,end=Math.max(0,(t-(span-320))/320),fadeIn=clamp(t/180),pop=.72+.28*easeOut(t/220);
 const art=haloArt(),haloScale=(pop*(1+Math.sin(t/260)*.04)+end*.5)*.62;
 c.save();c.globalCompositeOperation='lighter';c.globalAlpha*=fadeIn*(1-end)*.85;c.translate(cx,iconY);c.rotate(t/2600);c.scale(haloScale,haloScale);c.drawImage(art,-art.width/2,-art.height/2);c.restore();
 const card=itemCard(id);if(!card)return;
 const size=44*pop*(1+end*.08);
 c.save();c.globalAlpha*=fadeIn*(1-end);c.drawImage(card,cx-size/2,iconY-size/2,size,size);c.restore();
}
