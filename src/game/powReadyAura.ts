import {freeImage} from './spriteCache';

/**
 * POW ready (bar full, not yet used), as in DDTank (matheus, 21/10/2026). Paintings by Codex on black, cut by
 * scripts/build-pow-aura.py into strips of FRAMES looping frames with real alpha; the game only plays the strips and
 * moves them. Three looks, POW_READY_STYLE picks the one in the game:
 *  - aura: a thin oval of soft golden light strands around the fighter;
 *  - mantle: golden spirit wisps rising from behind the body;
 *  - orbs: two small light spirits with comet tails circling the fighter, passing behind and in front of it.
 * Nothing ever shows under the fighter (matheus): every look is cut at the feet.
 */
export type PowReadyStyle='aura'|'mantle'|'orbs';
export const POW_READY_STYLE:PowReadyStyle='mantle';
const FRAMES=6;
const ART={aura:{src:'/assets/combat/pow-ready-aura.png',size:256},mantle:{src:'/assets/combat/pow-ready-mantle.png',size:256},orb:{src:'/assets/combat/pow-ready-orb.png',size:128}} as const;
type Art=keyof typeof ART;
const images=new Map<Art,HTMLImageElement>();
const motionPreference=typeof window!=='undefined'&&window.matchMedia?window.matchMedia('(prefers-reduced-motion: reduce)'):null;
function sheet(key:Art){let image=images.get(key);if(!image){if(typeof Image==='undefined')return undefined;image=new Image();image.decoding='async';image.src=ART[key].src;images.set(key,image);}return image.complete&&image.naturalWidth?image:undefined;}
const artFor=(style:PowReadyStyle):Art=>style==='orbs'?'orb':style;

/** Warms the strip of the look in use (the loading screen awaits it). */
export function preloadPowReadyAura(style:PowReadyStyle=POW_READY_STYLE):HTMLImageElement[]{sheet(artFor(style));return [...images.values()];}
export function releasePowReadyAura(){for(const image of images.values())freeImage(image);images.clear();}

/** Frame, swell-in and light of the moment; `since` is when the bar filled, so the effect grows in instead of popping. */
function timing(time:number,since:number,frameMs:number){
 const t=motionPreference?.matches?0:time,grow=Math.min(1,Math.max(0,(time-since)/260));
 return {t,grow,beat:Math.sin(t/300),frame:Math.floor(t/frameMs)%FRAMES};
}
/** Cut at the feet: nothing below the fighter. */
function clipAboveFeet(c:CanvasRenderingContext2D,x:number,y:number){c.beginPath();c.rect(x-200,y-300,400,298);c.clip();}

/**
 * Draws the look around the fighter standing at (x, y). `layer` back goes before the avatar and front after it;
 * only the orbs use the front layer (the half of the orbit that passes in front of the body).
 */
export function drawPowReadyAura(c:CanvasRenderingContext2D,x:number,y:number,time:number,since:number,layer:'back'|'front'='back',style:PowReadyStyle=POW_READY_STYLE){
 if(style==='orbs'){drawOrbs(c,x,y,time,since,layer);return;}
 if(layer==='front')return;
 const art=sheet(style);if(!art)return;const {size}=ART[style];
 c.save();clipAboveFeet(c,x,y);
 if(style==='aura'){
  const {grow,beat,frame}=timing(time,since,120),scale=(.86+.14*grow)*(1+beat*.045),w=180*scale,h=150*scale;
  c.globalAlpha*=grow*(.8+beat*.15);c.drawImage(art,frame*size,0,size,size,x-w/2,y-40-h/2,w,h);
 }else{
  // The painted base sits 60 px above the bottom of a 512 px cell: it lands just under the body so the wisps rise from it.
  const {grow,beat,frame}=timing(time,since,110),s=170*(.9+.1*grow)*(1+beat*.03),base=s*(1-60/512);
  c.globalAlpha*=grow*(.72+beat*.12);c.drawImage(art,frame*size,0,size,size,x-s/2,y+6-base,s,s);
 }
 c.restore();
}

/** Two light spirits on a flat ellipse around the body, half a turn apart; the far half of the orbit is smaller and dimmer. */
function drawOrbs(c:CanvasRenderingContext2D,x:number,y:number,time:number,since:number,layer:'back'|'front'){
 const art=sheet('orb');if(!art)return;const {size}=ART.orb;
 const {t,grow,frame}=timing(time,since,90),rx=60*(.7+.3*grow),ry=10,cy=y-58,turn=t/2400*Math.PI*2;
 c.save();clipAboveFeet(c,x,y);
 for(let k=0;k<2;k++){
  const a=turn+k*Math.PI,front=Math.sin(a)>0;if(front!==(layer==='front'))continue;
  const ox=x+Math.cos(a)*rx,oy=cy+Math.sin(a)*ry+Math.sin(t/380+k*2)*3,depth=.78+.22*Math.sin(a);
  // The painted tail trails to the left of a spirit flying right: turn it along the orbit.
  const heading=Math.atan2(Math.cos(a)*ry,-Math.sin(a)*rx),s=62*depth;
  c.save();c.globalAlpha*=grow*(.55+.45*depth);c.translate(ox,oy);c.rotate(heading);
  // The core is painted at x=320 of 512, so the cell is shifted for the core to sit on the orbit.
  c.drawImage(art,((frame+k*3)%FRAMES)*size,0,size,size,-s*(320/512),-s/2,s,s);
  c.restore();
 }
 c.restore();
}
