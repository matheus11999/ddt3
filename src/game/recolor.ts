import {RECOLOR_ZONES} from './rig/recolorZones';
import type {RecolorZone} from './rig/recolorZones';

/** Ticket colors on painted art. Shading is kept: the zone's average lightness moves to the
 * target's and every other pixel keeps its distance, so folds, outlines and highlights survive. */
type Canvas=HTMLCanvasElement;
const clamp=(value:number)=>Math.max(0,Math.min(1,value));
export function hexRgb(hex:string):[number,number,number]{return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)) as [number,number,number];}
export function rgbHsl(r:number,g:number,b:number):[number,number,number]{
 r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,l=(max+min)/2;let h=0;
 if(d)h=max===r?((g-b)/d+(g<b?6:0))/6:max===g?((b-r)/d+2)/6:((r-g)/d+4)/6;
 return [h,d?d/(1-Math.abs(2*l-1)):0,l];
}
function channel(p:number,q:number,t:number){t=(t+1)%1;return t<1/6?p+(q-p)*6*t:t<.5?q:t<2/3?p+(q-p)*(2/3-t)*6:p;}
function hslRgb(h:number,s:number,l:number):[number,number,number]{const q=l<.5?l*(1+s):l+s-l*s,p=2*l-q;return [channel(p,q,h+1/3)*255,channel(p,q,h)*255,channel(p,q,h-1/3)*255];}
const hueDistance=(a:number,b:number)=>{const d=Math.abs(a-b)%1;return Math.min(d,1-d);};
const ramp=(value:number,from:number,to:number)=>clamp((value-from)/(to-from));

/** How much one pixel belongs to a zone (0–1), with soft edges so the border never looks cut out. */
export function zoneWeight(zone:RecolorZone,h:number,s:number,l:number):number{
 if(zone.hue===undefined)return 1;
 const tolerance=zone.tolerance??.06,min=zone.minSaturation??.2,d=hueDistance(h,zone.hue);
 const hue=d<=tolerance?1:1-ramp(d,tolerance,tolerance*1.6);
 return hue*ramp(s,min*.6,min)*ramp(l,.06,.14)*(1-ramp(l,.94,.99));
}
/** Repaints the pixels picked by `weight` to `hex`, keeping their light and shade. Returns the share that changed. */
/** `keepGrey` softens how much grey parts follow the zone's saturation: dark under-layers of hair turn
 * a deep shade of the new color instead of staying grey. */
export function repaint(data:Uint8ClampedArray,hex:string,weight:(h:number,s:number,l:number,index:number)=>number,keepGrey=1):number{
 const weights=new Float32Array(data.length/4);let total=0,sumL=0,sumS=0,opaque=0;
 for(let i=0,n=0;i<data.length;i+=4,n++){if(data[i+3]<8)continue;opaque++;const [h,s,l]=rgbHsl(data[i],data[i+1],data[i+2]),w=weight(h,s,l,n);if(w<=0)continue;weights[n]=w;total+=w;sumL+=l*w;sumS+=s*w;}
 if(!total)return 0;
 const [th,ts,tl]=rgbHsl(...hexRgb(hex)),meanL=sumL/total,meanS=Math.max(.05,sumS/total);
 for(let i=0,n=0;i<data.length;i+=4,n++){
  const w=weights[n];if(!w)continue;const [,s,l]=rgbHsl(data[i],data[i+1],data[i+2]);
  const light=l<meanL?l*tl/Math.max(.01,meanL):tl+(l-meanL)*(1-tl)/Math.max(.01,1-meanL);
  const relative=Math.min(1.6,s/meanS),[r,g,b]=hslRgb(th,clamp(ts*(1-keepGrey+keepGrey*relative)),clamp(light));
  data[i]=data[i]*(1-w)+r*w;data[i+1]=data[i+1]*(1-w)+g*w;data[i+2]=data[i+2]*(1-w)+b*w;
 }
 return opaque?total/opaque:0;
}
/** In-place ticket color of one cosmetic on a canvas holding only that piece. */
export function recolorItem(canvas:Canvas,id:string,hex:string|undefined){
 const zone=RECOLOR_ZONES[id];if(!zone||!hex)return 0;
 const c=canvas.getContext('2d',{willReadFrequently:true})!,pixels=c.getImageData(0,0,canvas.width,canvas.height);
 const share=repaint(pixels.data,hex,(h,s,l)=>zoneWeight(zone,h,s,l),zone.hue===undefined?.45:1);c.putImageData(pixels,0,0);return share;
}
/** Share of a piece's painted pixels its zone would repaint (validator). */
export function zoneCoverage(canvas:Canvas,id:string):number{
 const zone=RECOLOR_ZONES[id];if(!zone)return 0;
 const data=canvas.getContext('2d',{willReadFrequently:true})!.getImageData(0,0,canvas.width,canvas.height).data;let total=0,opaque=0;
 for(let i=0;i<data.length;i+=4){if(data[i+3]<8)continue;opaque++;const [h,s,l]=rgbHsl(data[i],data[i+1],data[i+2]);total+=zoneWeight(zone,h,s,l);}
 return opaque?total/opaque:0;
}

/** The painted skin of the universal head and bodies, measured on character-base.png. */
const SKIN_REFERENCE=[252,207,172] as const;
/** Painted skin keeps blue a steady function of green (both relative to red): b/r ≈ 1.2·g/r − 0.3, from the
 * light highlights down to the deep shade (measured on character-base.png and the painted outfits). */
function skinBand(r:number,g:number,b:number,strict=false){
 if(r<60||r<g||g<b)return 0;const gr=g/r,br=b/r,off=Math.abs(br-(1.2*gr-.3));
 if(strict)return ramp(gr,.42,.5)*(1-ramp(gr,.9,.95))*(1-ramp(br,.78,.86))*(1-ramp(off,.045,.075));
 return ramp(gr,.42,.5)*(1-ramp(gr,.97,1))*(1-ramp(off,.08,.14));
}
/** Light skin highlights left out by the strict band are skin when skin surrounds them on most sides. */
function fillHighlights(data:Uint8ClampedArray,width:number,weights:Float32Array,skip?:(x:number,y:number)=>boolean){
 const height=weights.length/width,radius=Math.max(2,Math.round(width/300)),add:number[]=[];
 for(let y=radius;y<height-radius;y++)for(let x=radius;x<width-radius;x++){
  const n=y*width+x,i=n*4;if(weights[n]>=.5||data[i+3]<8||skip?.(x,y))continue;
  const r=data[i],g=data[i+1],b=data[i+2];if(r<200||r<g||g<b||skinBand(r,g,b)<.5)continue;
  let skin=0,total=0;
  for(let dy=-radius;dy<=radius;dy+=radius)for(let dx=-radius;dx<=radius;dx+=radius){if(!dx&&!dy)continue;total++;if(weights[(y+dy)*width+x+dx]>=.5)skin++;}
  if(skin>=total-1)add.push(n);
 }
 for(const n of add)weights[n]=1;
}
/** Multiplies skin by target/reference, so light and shade keep their proportions on any tone.
 * Only connected regions holding bright skin highlights change: brown leather, gold trims or an orange
 * lining near the skin line stay as painted because nothing bright and skin-colored touches them. */
/** `strict` (painted outfits): white, cream and pink cloth sit right next to the skin and inside the
 * loose band, so only skin-saturated pixels count; the skin's own small highlights are then filled
 * back from the skin around them (`fillHighlights`). */
export function tintSkin(canvas:Canvas,hex:string|undefined,strict=false,skip?:(x:number,y:number)=>boolean){
 if(!hex)return;const c=canvas.getContext('2d',{willReadFrequently:true})!,pixels=c.getImageData(0,0,canvas.width,canvas.height),data=pixels.data;
 const width=canvas.width,count=data.length/4,weights=new Float32Array(count),seeds=new Uint8Array(count);
 for(let n=0,i=0;n<count;n++,i+=4){
  if(data[i+3]<8||skip?.(n%width,Math.floor(n/width)))continue;
  const r=data[i],g=data[i+1],b=data[i+2],w=skinBand(r,g,b,strict);if(!w)continue;weights[n]=w;
  if(r>200&&g/r>.72&&Math.abs(b/r-(1.2*g/r-.3))<.06)seeds[n]=1;
 }
 if(strict)fillHighlights(data,width,weights,skip);
 // Keep the connected regions (through the band) that hold enough highlight seeds.
 const label=new Int32Array(count).fill(-1),keep:boolean[]=[],stack:number[]=[],minSeeds=Math.max(4,Math.round(count/40000));
 for(let start=0;start<count;start++){
  if(weights[start]<.15||label[start]!==-1)continue;
  const id=keep.length;let found=0;label[start]=id;stack.push(start);
  while(stack.length){const n=stack.pop()!;found+=seeds[n];const x=n%width;
   for(const m of [x>0?n-1:-1,x<width-1?n+1:-1,n-width,n+width])if(m>=0&&m<count&&label[m]===-1&&weights[m]>=.15){label[m]=id;stack.push(m);}}
  keep.push(found>=minSeeds);
 }
 const target=hexRgb(hex),factor=target.map((value,i)=>value/SKIN_REFERENCE[i]);
 for(let n=0,i=0;n<count;n++,i+=4){
  let w=weights[n];if(!w)continue;
  if(label[n]>=0){if(!keep[label[n]])continue;}
  else{// Faint edge pixels below the region threshold follow their strongest kept neighbour.
   const x=n%width,near=[x>0?n-1:-1,x<width-1?n+1:-1,n-width,n+width].some(m=>m>=0&&m<count&&label[m]>=0&&keep[label[m]]);if(!near)continue;}
  w=Math.min(1,w*1.4);
  for(let k=0;k<3;k++)data[i+k]=data[i+k]*(1-w)+Math.min(255,data[i+k]*factor[k])*w;
 }
 c.putImageData(pixels,0,0);
}
export type Ellipse={x:number;y:number;rx:number;ry:number};
const inside=(e:Ellipse,x:number,y:number,grow=1)=>((x-e.x)/(e.rx*grow))**2+((y-e.y)/(e.ry*grow))**2<=1;
/** The iris only: warm, saturated mid-tones inside the eye sockets. Lashes, pupils and the white stay. */
export function tintEyes(canvas:Canvas,hex:string|undefined,eyes:readonly Ellipse[]){
 if(!hex)return;const c=canvas.getContext('2d',{willReadFrequently:true})!,pixels=c.getImageData(0,0,canvas.width,canvas.height);
 repaint(pixels.data,hex,(h,s,l,n)=>{const x=n%canvas.width,y=Math.floor(n/canvas.width);if(!eyes.some(e=>inside(e,x,y)))return 0;return (hueDistance(h,.08)<.07?1:1-ramp(hueDistance(h,.08),.07,.11))*ramp(s,.2,.32)*ramp(l,.13,.2)*(1-ramp(l,.78,.88));});
 c.putImageData(pixels,0,0);
}
export const insideAny=(eyes:readonly Ellipse[],x:number,y:number,grow=1)=>eyes.some(e=>inside(e,x,y,grow));
