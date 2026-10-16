import {composeUniversalHead} from './faces';
import {CATALOG,DYES} from '../../shared/catalog';
import type {DyeSlot,Equipment,ItemVisual,Slot} from '../../shared/catalog';

export const AVATAR_UNIT=160/1254;
const SIZE=1254,RESOLUTION=.5;
const sources=new Map<string,HTMLImageElement>(),rigCache=new Map<string,AvatarRig>(),artCache=new Map<string,HTMLCanvasElement>(),faceCache=new Map<string,HTMLCanvasElement>();
const canvas=(w:number,h:number)=>{const el=document.createElement('canvas');el.width=Math.ceil(w);el.height=Math.ceil(h);return el;};
export const asset=(path:string)=>{let image=sources.get(path);if(!image){image=new Image();image.src=path;image.onload=()=>{rigCache.clear();artCache.clear();faceCache.clear();window.dispatchEvent(new Event('brasa-art-loaded'));};sources.set(path,image);}return image;};
const original=asset('/assets/adventurer.png'),modular=asset('/assets/character-base.png');
const modularDependencies=['/assets/hair-spiky.png','/assets/hair-wavy.png','/assets/outfit-azure-body.png','/assets/outfit-royal-body.png'];
export const ENABLE_MODULAR_APPEARANCE:boolean=false;
/** Never reveal an unfinished bald base while the painted layers are loading. */
export const modularAppearanceReady=()=>ENABLE_MODULAR_APPEARANCE&&modular.complete&&modular.naturalWidth>0&&modularDependencies.every(path=>{const image=asset(path);return image.complete&&image.naturalWidth>0;});
type Point=readonly[number,number];
export interface AvatarPart {canvas:HTMLCanvasElement;x:number;y:number;width:number;height:number;pivot:Point;}
export interface AvatarRig {head:AvatarPart;torso:AvatarPart;leftArm:AvatarPart;rightArm:AvatarPart;leftLeg:AvatarPart;rightLeg:AvatarPart;modular:boolean;outfitPose:'adventurer'|'confident'|'regal';}
export interface LayerDefinition {anchor:'head'|'chest'|'hands'|'hips'|'feet'|'back'|'world';order:number;bounds:[number,number,number,number];}
/** New assets reuse a slot's anchor; visual.offset/scale/rotation refine individual fits. */
export const AVATAR_LAYERS:Partial<Record<Slot,LayerDefinition>>={
 outfit:{anchor:'chest',order:30,bounds:[-30,-81,60,82]},face:{anchor:'head',order:50,bounds:[-625*AVATAR_UNIT,-1225*AVATAR_UNIT,160,160]},hair:{anchor:'head',order:54,bounds:[-625*AVATAR_UNIT,-1225*AVATAR_UNIT,160,160]},glasses:{anchor:'head',order:55,bounds:[-10,-111,42,25]},hat:{anchor:'head',order:56,bounds:[-46,-169,94,67]}
};
export function visual(eq:Equipment,slot:Slot):ItemVisual {
 const item=CATALOG[eq[slot]],v=item?.visual??{variant:eq[slot]?.replace(`${slot}-`,'')??'none'};
 const dye=eq.dyes?.[slot as DyeSlot],color=DYES.find(d=>d.id===dye&&d.id!=='original')?.color;
 return {...v,color:color??v.color??item?.color??'#b68c63'};
}
export function ellipse(c:CanvasRenderingContext2D,x:number,y:number,rx:number,ry:number,color:string|CanvasGradient,stroke?:string){c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=color;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=1.3;c.stroke();}}
function polygon(c:CanvasRenderingContext2D,points:readonly Point[]){c.moveTo(...points[0]);for(const p of points.slice(1))c.lineTo(...p);c.closePath();}
function hsl(color:string){const r=parseInt(color.slice(1,3),16)/255,g=parseInt(color.slice(3,5),16)/255,b=parseInt(color.slice(5,7),16)/255,max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,l=(max+min)/2;let h=0;if(d)h=max===r?((g-b)/d+(g<b?6:0))/6:max===g?((b-r)/d+2)/6:((r-g)/d+4)/6;return {h,s:d?d/(1-Math.abs(2*l-1)):0};}
function hue(p:number,q:number,t:number){t=(t+1)%1;return t<1/6?p+(q-p)*6*t:t<.5?q:t<2/3?p+(q-p)*(2/3-t)*6:p;}
function recolor(data:Uint8ClampedArray,index:number,h:number,s:number,weight=1,luminance=1){const r=data[index]/255,g=data[index+1]/255,b=data[index+2]/255,l=(Math.max(r,g,b)+Math.min(r,g,b))/2*luminance,q=l<.5?l*(1+s):l+s-l*s,p=2*l-q;const rgb=[hue(p,q,h+1/3),hue(p,q,h),hue(p,q,h-1/3)];for(let n=0;n<3;n++)data[index+n]=Math.round(data[index+n]*(1-weight)+rgb[n]*255*weight);}
function tint(source:HTMLCanvasElement,color:string,path:(c:CanvasRenderingContext2D)=>void,luminance=1,sourceHue?:number){
 const mask=canvas(source.width,source.height),m=mask.getContext('2d')!;m.scale(RESOLUTION,RESOLUTION);m.beginPath();path(m);m.fill('evenodd');
 const c=source.getContext('2d',{willReadFrequently:true})!,pixels=c.getImageData(0,0,source.width,source.height),coverage=m.getImageData(0,0,source.width,source.height).data,{h,s}=hsl(color);
 for(let i=0;i<pixels.data.length;i+=4)if(pixels.data[i+3]&&coverage[i+3]){
  if(sourceHue!==undefined){const current=hsl('#'+[0,1,2].map(n=>pixels.data[i+n].toString(16).padStart(2,'0')).join('')),delta=Math.abs(current.h-sourceHue);if(current.s<.12||Math.min(delta,1-delta)>.13)continue;}
  recolor(pixels.data,i,h,s,coverage[i+3]/255,luminance);
 }c.putImageData(pixels,0,0);
}
function cut(source:HTMLCanvasElement,points:readonly Point[],pivot:Point):AvatarPart{
 const x=Math.floor(Math.min(...points.map(p=>p[0]))),y=Math.floor(Math.min(...points.map(p=>p[1]))),width=Math.ceil(Math.max(...points.map(p=>p[0]))-x),height=Math.ceil(Math.max(...points.map(p=>p[1]))-y),layer=canvas(width*RESOLUTION,height*RESOLUTION),c=layer.getContext('2d')!;
 c.scale(RESOLUTION,RESOLUTION);c.translate(-x,-y);c.beginPath();polygon(c,points);c.clip();c.drawImage(source,0,0,SIZE,SIZE);return {canvas:layer,x,y,width,height,pivot};
}
export function avatarRig(eq:Equipment):AvatarRig|null{
 const ready=modularAppearanceReady(),face=getFacePortrait(eq.face),hair=asset(visual(eq,'hair').asset??'/assets/hair-spiky.png'),headReady=!!face&&(eq.hair==='hair-none'||hair.complete&&hair.naturalWidth>0||asset('/assets/hair-spiky.png').naturalWidth>0),base=headReady?modular:original;if(!base.complete||!base.naturalWidth)return null;
 const outfit=visual(eq,'outfit'),bodyImage=ready?(outfit.variant==='ranger'?original:outfit.asset?asset(outfit.asset):base):base,bodyReady=ready&&bodyImage.complete&&bodyImage.naturalWidth>0,body=bodyReady?bodyImage:original;
 const key=JSON.stringify([base.src,body.src,eq.outfit,eq.dyes?.outfit,headReady?eq.face:'original']);const cached=rigCache.get(key);if(cached){rigCache.delete(key);rigCache.set(key,cached);return cached;}
 const source=canvas(SIZE*RESOLUTION,SIZE*RESOLUTION),c=source.getContext('2d',{willReadFrequently:true})!;c.drawImage(body,0,0,source.width,source.height);
 const dyed=eq.dyes?.outfit&&eq.dyes.outfit!=='original',fallback=!bodyReady&&eq.outfit!=='outfit-ranger';
 if(dyed||fallback)tint(source,outfit.color!,ctx=>{
  if(body!==base&&body!==original){ctx.rect(300,605,650,649);return;}
  polygon(ctx,[[552,621],[584,625],[625,664],[680,687],[717,630],[741,657],[770,835],[743,864],[694,848],[663,873],[548,836],[528,805],[540,731]]);
  for(const [x,y]of [[687,727],[694,766],[694,804]]){ctx.moveTo(x+11,y);ctx.arc(x,y,11,0,Math.PI*2);}
 },1,body===base||body===original?undefined:hsl(CATALOG[eq.outfit]?.color??'#bd7544').h);
 // The head is always the neutral head; an outfit owns every body part, never facial pixels.
 const headSource=canvas(SIZE*RESOLUTION,SIZE*RESOLUTION);headSource.getContext('2d')!.drawImage(headReady?face!:base,0,0,headSource.width,headSource.height);
 const rig:AvatarRig={modular:headReady,outfitPose:outfit.pose??'adventurer',
  head:cut(headSource,[[265,0],[991,0],[991,600],[727,608],[701,631],[622,629],[542,608],[265,608]],[650,610]),
  torso:cut(source,[[540,594],[710,603],[739,653],[721,704],[743,761],[770,819],[765,875],[787,975],[652,986],[632,976],[504,984],[492,916],[521,845],[537,783],[542,735],[525,691],[531,637]],[630,837]),
  leftArm:cut(source,[[525,623],[549,644],[562,690],[555,739],[551,799],[529,838],[510,861],[500,903],[485,945],[456,945],[421,921],[420,882],[440,840],[420,796],[444,752],[474,699],[488,661]],[526,661]),
  rightArm:cut(source,[[716,641],[746,664],[766,724],[811,780],[817,825],[832,891],[835,930],[809,953],[785,941],[766,915],[768,862],[739,815],[733,767],[719,709]],[730,681]),
  leftLeg:cut(source,[[505,960],[644,960],[635,984],[605,1006],[585,1050],[608,1248],[414,1248],[438,1036],[483,984]],[576,973]),
  rightLeg:cut(source,[[649,960],[782,960],[775,987],[754,1044],[864,1248],[626,1248],[643,1048],[650,980]],[708,974])};
 rigCache.set(key,rig);if(rigCache.size>32)rigCache.delete(rigCache.keys().next().value!);return rig;
}
export function drawPart(c:CanvasRenderingContext2D,part:AvatarPart,angle=0,dx=0,dy=0){c.save();c.translate((part.pivot[0]-625)*AVATAR_UNIT+dx,(part.pivot[1]-1225)*AVATAR_UNIT+dy);c.rotate(angle);c.drawImage(part.canvas,(part.x-part.pivot[0])*AVATAR_UNIT,(part.y-part.pivot[1])*AVATAR_UNIT,part.width*AVATAR_UNIT,part.height*AVATAR_UNIT);c.restore();}

export function shade(color:string,factor:number){return '#'+[1,3,5].map(i=>Math.round(Math.min(255,parseInt(color.slice(i,i+2),16)*factor)).toString(16).padStart(2,'0')).join('');}
export function material(c:CanvasRenderingContext2D,color:string){const g=c.createLinearGradient(-30,-35,35,13);g.addColorStop(0,shade(color,1.45));g.addColorStop(.42,color);g.addColorStop(1,shade(color,.55));return g;}
function layer(c:CanvasRenderingContext2D,v:ItemVisual,draw:()=>void){if(v.variant==='none'||v.visible===false)return;c.save();c.translate(...(v.offset??[0,0]));c.rotate(v.rotation??0);c.scale(v.scale??1,v.scale??1);draw();c.restore();}
function tintedArt(path:string,color?:string,clothOnly=false,trim=false){
 const img=asset(path);if(!img.complete||!img.naturalWidth)return null;const key=`${path}:${color??''}:${clothOnly}:${trim}`;const known=artCache.get(key);if(known)return known;
 const scale=Math.min(1,400/img.naturalWidth),out=canvas(img.naturalWidth*scale,img.naturalHeight*scale),c=out.getContext('2d',{willReadFrequently:true})!;c.drawImage(img,0,0,out.width,out.height);
 if(color){const pixels=c.getImageData(0,0,out.width,out.height),{h,s}=hsl(color);for(let i=0;i<pixels.data.length;i+=4){if(!pixels.data[i+3])continue;if(clothOnly&&(pixels.data[i]>pixels.data[i+1]*.96||pixels.data[i+2]<pixels.data[i]*1.06))continue;recolor(pixels.data,i,h,s);}c.putImageData(pixels,0,0);}
 let result=out;if(trim){const pixels=c.getImageData(0,0,out.width,out.height);let left=out.width,right=0,top=out.height,bottom=0;for(let y=0;y<out.height;y++)for(let x=0;x<out.width;x++)if(pixels.data[(y*out.width+x)*4+3]>8){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}if(left<right&&top<bottom){result=canvas(right-left+1,bottom-top+1);result.getContext('2d')!.drawImage(out,left,top,right-left+1,bottom-top+1,0,0,result.width,result.height);}}
 artCache.set(key,result);if(artCache.size>64)artCache.delete(artCache.keys().next().value!);return result;
}

export function getFacePortrait(id:string):HTMLCanvasElement|null {
 const path=CATALOG[id]?.slot==='face'?CATALOG[id].visual?.asset:undefined;if(!path)return null;
 const image=asset(path);if(!modular.complete||!modular.naturalWidth||!image.complete||!image.naturalWidth)return null;
 const cached=faceCache.get(id);if(cached)return cached;
 const head=composeUniversalHead(modular,image);faceCache.set(id,head);return head;
}
function drawGlasses(c:CanvasRenderingContext2D,v:ItemVisual,time:number){layer(c,v,()=>{
 const pilot=v.variant==='pilot';c.strokeStyle=shade(v.color!,.5);c.lineWidth=pilot?2.2:1.35;const glass=c.createLinearGradient(0,-111,0,-88);glass.addColorStop(0,pilot?'#70b7cf80':'#e5fcff12');glass.addColorStop(1,'#72c6da16');
 for(const [x,y,rx,ry]of [[3.5,-100,9,9.7],[21.5,-95.8,7,8.2]]){ellipse(c,x,y,rx,ry,glass,v.color);c.strokeStyle='#f6edc9';c.lineWidth=.65;c.beginPath();c.ellipse(x,y,rx-.8,ry-.8,0,Math.PI,Math.PI*1.7);c.stroke();}
 c.strokeStyle=v.color!;c.lineWidth=1.4;c.beginPath();c.moveTo(11,-100);c.quadraticCurveTo(14,-101,16,-97);c.moveTo(-5,-102);c.lineTo(-13,-107);c.stroke();c.globalAlpha=.25+Math.sin(time/700)*.15;c.strokeStyle='#e7ffff';c.beginPath();c.moveTo(-1,-106);c.lineTo(6,-99);c.moveTo(19,-102);c.lineTo(24,-97);c.stroke();
 });}
const HAT_FITS:Record<string,{width:number;maxHeight:number;bottom:number;center:number;rotation:number}>={
 cap:{width:78,maxHeight:60,bottom:-123,center:2,rotation:.035},
 mage:{width:83,maxHeight:65,bottom:-117,center:0,rotation:.035},
 pilot:{width:65,maxHeight:39,bottom:-124,center:1,rotation:-.08},
 knight:{width:78,maxHeight:69,bottom:-109,center:0,rotation:.025}
};
function drawHat(c:CanvasRenderingContext2D,eq:Equipment){const v=visual(eq,'hat');layer(c,v,()=>{
 if(v.variant==='cap'||v.asset){const tintColor=eq.dyes?.hat&&eq.dyes.hat!=='original'?v.color:undefined,art=tintedArt(v.asset??'/assets/hat-cap.png',tintColor,v.variant==='cap',true);if(art){const fit=HAT_FITS[v.variant]??HAT_FITS.cap,ratio=Math.min(fit.width/art.width,fit.maxHeight/art.height),width=art.width*ratio,height=art.height*ratio;ellipse(c,fit.center,fit.bottom-1,width*.34,3.2,'#17242e20');c.save();c.rotate(fit.rotation);c.drawImage(art,fit.center-width/2,fit.bottom-height,width,height);c.restore();}return;}
 if(v.variant==='pilot'){c.translate(2,-120);c.rotate(-.105);c.strokeStyle='#35251f44';c.lineWidth=10;c.beginPath();c.moveTo(-35,-1);c.quadraticCurveTo(0,-12,32,-1);c.stroke();c.strokeStyle='#77533d';c.lineWidth=7;c.beginPath();c.moveTo(-35,-4);c.quadraticCurveTo(0,-15,32,-4);c.stroke();const g=material(c,v.color!);ellipse(c,-12,-4,14,10,g,'#68462e');ellipse(c,15,-3,12,9,g,'#68462e');ellipse(c,-12,-4,10,6.7,'#5798b4','#f3d595');ellipse(c,15,-3,8.5,5.8,'#5798b4','#f3d595');c.strokeStyle='#d5f5ff';c.lineWidth=1.5;c.beginPath();c.moveTo(-18,-5);c.lineTo(-10,-8);c.moveTo(10,-4);c.lineTo(17,-6);c.stroke();}
 else if(v.variant==='mage'){c.translate(0,-125);c.rotate(.045);ellipse(c,0,7,40,8,'#25202d44');c.fillStyle=material(c,v.color!);c.strokeStyle=shade(v.color!,.5);c.lineWidth=1.5;c.beginPath();c.moveTo(-30,0);c.quadraticCurveTo(-16,-34,-9,-51);c.quadraticCurveTo(16,-57,17,-34);c.lineTo(32,2);c.closePath();c.fill();c.stroke();ellipse(c,1,3,43,10,material(c,v.color!),shade(v.color!,.5));c.strokeStyle='#e9cf8e';c.lineWidth=4;c.beginPath();c.moveTo(-23,-8);c.quadraticCurveTo(0,0,24,-7);c.stroke();c.fillStyle='#ffe3a3';c.font='bold 21px Georgia';c.fillText('✦',-5,-25);}
 else if(v.variant==='knight'){c.translate(0,-118);c.rotate(.025);ellipse(c,0,9,35,8,'#25313a44');c.fillStyle=material(c,v.color!);c.strokeStyle=shade(v.color!,.48);c.lineWidth=1.7;c.beginPath();c.moveTo(-36,9);c.quadraticCurveTo(-42,-43,0,-41);c.quadraticCurveTo(37,-42,36,9);c.lineTo(21,1);c.lineTo(1,-5);c.lineTo(-21,5);c.closePath();c.fill();c.stroke();c.strokeStyle='#eff9e0aa';c.lineWidth=1.5;c.beginPath();c.moveTo(-29,-10);c.quadraticCurveTo(-23,-34,2,-34);c.stroke();c.fillStyle='#b8555c';c.beginPath();c.moveTo(-5,-38);c.quadraticCurveTo(-17,-64,21,-57);c.quadraticCurveTo(6,-49,6,-38);c.fill();}
 });}
export function drawHeadLayers(c:CanvasRenderingContext2D,eq:Equipment,time:number,emotion:string,isModular:boolean){

 const hair=visual(eq,'hair'),hat=visual(eq,'hat');if(isModular&&hair.variant!=='none'&&!hat.hideHair&&hat.variant!=='knight')layer(c,hair,()=>{
  const originalHair=eq.hair==='hair-spiky'||eq.hair==='hair-wavy',dyed=eq.dyes?.hair&&eq.dyes.hair!=='original';const art=tintedArt(hair.asset??'/assets/hair-spiky.png',!originalHair||dyed?hair.color:undefined)??tintedArt('/assets/hair-spiky.png',dyed?hair.color:undefined);if(art)c.drawImage(art,-625*AVATAR_UNIT,-1225*AVATAR_UNIT,160,160);
 });
 drawGlasses(c,visual(eq,'glasses'),time);drawHat(c,eq);
}
export function drawBackLayers(c:CanvasRenderingContext2D,eq:Equipment,time:number,walk:number){
 if(eq.outfit==='outfit-royal'){const color=visual(eq,'outfit').color!;c.fillStyle=material(c,color);c.strokeStyle='#d9b779';c.lineWidth=1.2;c.beginPath();c.moveTo(-11,-79);c.quadraticCurveTo(-37,-67,-35+Math.sin(time/210)*4*walk-Math.sin(time/500),-29);c.lineTo(-2,-36);c.lineTo(12,-77);c.closePath();c.fill();c.stroke();}
}
