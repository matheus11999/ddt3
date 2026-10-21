import {freeImage} from './spriteCache';

/**
 * POW ready (bar full, not yet used): a golden energy aura hugging the lying fighter, flickering, as in DDTank
 * (matheus chose it on 21/10/2026 after rejecting fire rings, light ovals, mantles, orbs, wings and more). Painted by
 * Codex around the green silhouette of the lying fighter (source/pow-ready-silhouette.png, the fighter drawn 2.6x
 * with its feet at y=452 of each 512 px cell) and cut by scripts/build-pow-aura.py into FRAMES frames of SIZE px.
 * Nothing ever shows under the fighter (matheus): the aura is cut at the feet.
 */
const SRC='/assets/combat/pow-ready-aura-gold.png',FRAMES=6,SIZE=256,FRAME_MS=120;
const DRAW=512/2.6,FEET=452/512;
let image:HTMLImageElement|undefined;
const motionPreference=typeof window!=='undefined'&&window.matchMedia?window.matchMedia('(prefers-reduced-motion: reduce)'):null;
function sheet(){if(!image){if(typeof Image==='undefined')return undefined;image=new Image();image.decoding='async';image.src=SRC;}return image.complete&&image.naturalWidth?image:undefined;}

/** Warms the strip (the loading screen awaits it). */
export function preloadPowReadyAura():HTMLImageElement[]{sheet();return image?[image]:[];}
export function releasePowReadyAura(){if(image)freeImage(image);image=undefined;}

/**
 * Behind the fighter lying at (x, y), painted facing right and turned with it; `since` is when the bar filled, so the
 * aura swells in instead of popping.
 */
export function drawPowReadyAura(c:CanvasRenderingContext2D,x:number,y:number,time:number,since:number,facing:1|-1=1){
 const art=sheet();if(!art)return;
 const t=motionPreference?.matches?0:time,grow=Math.min(1,Math.max(0,(time-since)/260)),beat=Math.sin(t/300),frame=Math.floor(t/FRAME_MS)%FRAMES;
 const s=DRAW*(.94+.06*grow);
 c.save();c.beginPath();c.rect(x-200,y-300,400,298);c.clip();
 c.translate(x,y);c.scale(facing,1);c.globalAlpha*=grow*(.85+beat*.12);
 c.drawImage(art,frame*SIZE,0,SIZE,SIZE,-s/2,-s*FEET,s,s);
 c.restore();
}
