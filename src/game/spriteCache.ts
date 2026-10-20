/**
 * Big paintings drawn small, every frame, were the costliest part of a frame: a 1254 px weapon or a
 * 1400 px lobby keeper squeezed to a few dozen screen pixels makes the browser filter the whole image
 * again on every paint, and the first paint decodes the file on the main thread (a visible hitch).
 *
 * `drawScaled` keeps one copy of the image already resized to the size it occupies on screen
 * (rounded up to the next step of 25%) and draws that instead. The file is decoded and the copy
 * resized by the browser off the main thread; meanwhile the image is skipped (until decoded) and then
 * drawn as before (until resized).

 */
type Source=HTMLImageElement|HTMLCanvasElement;
type Drawable=Source|ImageBitmap;
const decoded=new WeakMap<HTMLImageElement,'pending'|'ready'|'failed'>();
const copies=new WeakMap<Source,Map<number,Drawable|'pending'>>();
const STEP=1.25;

/** True once the image can be drawn without decoding it on the main thread. */
export function imageReady(image:HTMLImageElement):boolean{
 if(!image.complete||!image.naturalWidth)return false;
 const state=decoded.get(image);
 if(state==='ready'||state==='failed')return true;
 if(!state){decoded.set(image,'pending');image.decode().then(()=>decoded.set(image,'ready'),()=>decoded.set(image,'failed'));}
 return false;
}
function sourceWidth(source:Drawable){return source instanceof HTMLImageElement?source.naturalWidth:source.width;}
function sourceHeight(source:Drawable){return source instanceof HTMLImageElement?source.naturalHeight:source.height;}
/** Halving steps keep the small copy as smooth as the browser's best filter (fallback when the resize cannot run off the main thread). */
function shrink(source:Source,width:number,height:number){
 let current:Source=source,w=sourceWidth(source),h=sourceHeight(source);
 while(w/2>=width&&h/2>=height){
  const step=document.createElement('canvas');step.width=Math.ceil(w/2);step.height=Math.ceil(h/2);
  const c=step.getContext('2d')!;c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(current,0,0,step.width,step.height);
  current=step;w=step.width;h=step.height;
 }
 const out=document.createElement('canvas');out.width=width;out.height=height;
 const c=out.getContext('2d')!;c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(current,0,0,width,height);
 return out;
}
/**
 * The copy of `source` at least `pixels` wide (in steps of 25%), or the source itself when it is not
 * much bigger than that. While the copy is being resized off the main thread, another size already
 * made stands in; null when there is none yet.
 */
export function scaledCopy(source:Source,pixels:number):Drawable|null{
 const natural=sourceWidth(source);if(!natural)return source;
 const bucket=Math.ceil(Math.log(Math.max(1,pixels))/Math.log(STEP)),width=Math.ceil(STEP**bucket);
 if(width*1.5>=natural)return source;
 let sizes=copies.get(source);if(!sizes){sizes=new Map();copies.set(source,sizes);}
 const copy=sizes.get(bucket);if(copy&&copy!=='pending')return copy;
 if(!copy){
  const height=Math.max(1,Math.round(width*sourceHeight(source)/natural)),done=sizes;
  if(typeof createImageBitmap==='undefined'){const out=shrink(source,width,height);sizes.set(bucket,out);return out;}
  sizes.set(bucket,'pending');
  // A copy that arrives after its painting was let go (`forgetCopies`) is closed at once.
  createImageBitmap(source,{resizeWidth:width,resizeHeight:height,resizeQuality:'high'}).then(bitmap=>{if(copies.get(source)===done)done.set(bucket,bitmap);else bitmap.close();},()=>{if(copies.get(source)===done)done.set(bucket,shrink(source,width,height));});
 }
 let nearest:Drawable|null=null,gap=Infinity;
 for(const [other,ready] of sizes)if(ready!=='pending'&&Math.abs(other-bucket)<gap){nearest=ready;gap=Math.abs(other-bucket);}
 return nearest;
}
/** Screen pixels per canvas unit along x under the current transform (squashes such as breathing only touch y). */
export function screenScale(c:CanvasRenderingContext2D){const m=c.getTransform();return Math.hypot(m.a,m.b);}
/** drawImage(image,x,y,width,height) once the file is decoded off the main thread; false (nothing drawn) until then. */
export function drawDecoded(c:CanvasRenderingContext2D,image:HTMLImageElement,x:number,y:number,width:number,height:number):boolean{
 if(!imageReady(image))return false;
 c.drawImage(image,x,y,width,height);
 return true;
}
/**
 * drawImage(image,x,y,width,height) through a copy at the size it takes on screen. Returns false
 * (and draws nothing) while the file is still loading, decoding or being resized.
 */
export function drawScaled(c:CanvasRenderingContext2D,image:HTMLImageElement,x:number,y:number,width:number,height:number):boolean{
 if(!imageReady(image))return false;
 const art=scaledCopy(image,Math.abs(width)*screenScale(c));if(!art)return false;
 c.drawImage(art,x,y,width,height);
 return true;
}

/**
 * Leaving an area (the plaza, the Pescaria, a battle) must give its memory back at once: the browser
 * only frees pixels when the garbage collector runs, which can take long because the paintings live
 * outside the JavaScript heap, so the next area (a battle) starts with the last one still in memory.
 */
/** Empties a canvas or closes a bitmap now: its pixels go back to the browser right away. */
export function freeSurface(surface:Drawable|'pending'|null|undefined){
 if(!surface||surface==='pending'||surface instanceof HTMLImageElement)return;
 if(surface instanceof HTMLCanvasElement){surface.width=0;surface.height=0;}else surface.close();
}
/** Frees the resized copies `drawScaled`/`scaledCopy` keep of `source`. */
export function forgetCopies(source:Source){const sizes=copies.get(source);if(!sizes)return;copies.delete(source);for(const copy of sizes.values())freeSurface(copy);}
/** Lets go of a painting only its area uses: its resized copies and its decoded pixels (the file stays in the HTTP cache). */
export function freeImage(image:HTMLImageElement){forgetCopies(image);decoded.delete(image);image.onload=image.onerror=null;image.removeAttribute('src');}
/** freeImage/freeSurface for every value of a cache, then empties it. */
export function freeAll(cache:Map<unknown,HTMLImageElement|HTMLCanvasElement|null|undefined>){
 for(const item of cache.values()){if(item instanceof HTMLImageElement)freeImage(item);else{if(item)forgetCopies(item);freeSurface(item);}}
 cache.clear();
}
