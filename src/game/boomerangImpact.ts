import clips from './boomerangImpactData.json';
import {freeImage} from './spriteCache';

export const BOOMERANG_IMPACT_DURATION=51/24*1000;
type Clip=typeof clips.normal;
type Cached={image:HTMLImageElement;ready:Promise<void>;loaded:boolean};
const cache=new Map<string,Cached>();
function sheet(clip:Clip){
 let entry=cache.get(clip.url);if(entry)return entry;
 const image=new Image();entry={image,loaded:false,ready:Promise.resolve()};const current=entry;
 current.ready=new Promise<void>(resolve=>{image.onload=()=>{current.loaded=true;resolve();};image.onerror=()=>resolve();});
 cache.set(clip.url,current);image.src=clip.url;return current;
}
/** Lets the impact sheets go when the battle ends (they come back with the next battle that needs them). */
export function releaseBoomerangImpacts(){for(const entry of cache.values())freeImage(entry.image);cache.clear();}
export function preloadBoomerangImpacts(){return Promise.all([sheet(clips.normal).ready,sheet(clips.pow).ready]);}
/** One shared timeline for all normal-family upgrades; POW has its own 471 timeline.
 * The PNG registration comes from the original SWF bounds, not the image centre. */
export function drawBoomerangImpact(c:CanvasRenderingContext2D,x:number,y:number,elapsed:number,powered:boolean,reducedMotion=false){
 if(elapsed<0||elapsed>=BOOMERANG_IMPACT_DURATION)return;
 const clip=powered?clips.pow:clips.normal,atlas=sheet(clip);if(!atlas.loaded)return;
 const frame=reducedMotion?8:Math.min(50,Math.floor(elapsed*clip.fps/1000+1e-7)),cell=clip.frames[frame];if(cell<0)return;
 c.save();if(reducedMotion)c.globalAlpha*=Math.max(0,1-elapsed/450);
 c.drawImage(atlas.image,cell%clip.columns*clip.width,Math.floor(cell/clip.columns)*clip.height,clip.width,clip.height,
  x-clip.origin[0]*clip.scale,y-clip.origin[1]*clip.scale,clip.width*clip.scale,clip.height*clip.scale);
 c.restore();
}
