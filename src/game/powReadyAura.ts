import {freeImage} from './spriteCache';

/**
 * POW ready (bar full, not yet used): a thin oval of soft golden light strands around the fighter that flickers and pulses, as in
 * DDTank (matheus, 21/10/2026). Painted by Codex on black and cut by scripts/build-pow-aura.py into a strip of
 * FRAMES flicker frames of SIZE px with real alpha; the game only plays the strip and breathes its scale and light.
 */
const SRC='/assets/combat/pow-ready-aura.png',FRAMES=6,SIZE=256,FRAME_MS=120;
/** Drawn size around a 112 px combat fighter: wider than tall, so the oval holds the head and the body lying behind it. */
const WIDTH=180,HEIGHT=150;
let image:HTMLImageElement|undefined;
const motionPreference=typeof window!=='undefined'&&window.matchMedia?window.matchMedia('(prefers-reduced-motion: reduce)'):null;
function sheet(){if(!image){if(typeof Image==='undefined')return undefined;image=new Image();image.decoding='async';image.src=SRC;}return image.complete&&image.naturalWidth?image:undefined;}

/** Warms the strip (the loading screen awaits it). */
export function preloadPowReadyAura():HTMLImageElement[]{sheet();return image?[image]:[];}
export function releasePowReadyAura(){if(image)freeImage(image);image=undefined;}

/** Behind the fighter, centred on the body; `since` is when the bar filled, so the aura swells in instead of popping. */
export function drawPowReadyAura(c:CanvasRenderingContext2D,x:number,y:number,time:number,since:number){
 const art=sheet();if(!art)return;
 const t=motionPreference?.matches?0:time,grow=Math.min(1,Math.max(0,(time-since)/260));
 const beat=Math.sin(t/300),scale=(.86+.14*grow)*(1+beat*.045),frame=Math.floor(t/FRAME_MS)%FRAMES;
 const w=WIDTH*scale,h=HEIGHT*scale,cx=x,cy=y-40;
 // Never under the fighter (matheus): the oval is cut at the feet, so only the part around the body shows.
 c.save();c.beginPath();c.rect(cx-w,cy-h,w*2,y-2-(cy-h));c.clip();c.globalAlpha*=grow*(.8+beat*.15);
 c.drawImage(art,frame*SIZE,0,SIZE,SIZE,cx-w/2,cy-h/2,w,h);
 c.restore();
}
