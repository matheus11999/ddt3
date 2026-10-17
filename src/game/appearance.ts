import {composeUniversalHead,FACE_REGISTRATION} from './faces';
import {CATALOG,DYES} from '../../shared/catalog';
import type {DyeSlot,Equipment,ItemVisual,Slot} from '../../shared/catalog';
import {drawWornHat,getHeadwearProfile} from './headwear';
import {cutRegion,drawPinned} from './rig/draw';
import {COSMETIC_MANIFEST,onTemplate} from './rig/manifest';
import type {ArtRegion} from './rig/manifest';
import {EAR_FRONT,HEAD_ANCHORS} from './rig/anchors';

export const AVATAR_UNIT=160/1254;
const SIZE=1254,RESOLUTION=.5;
const sources=new Map<string,HTMLImageElement>(),rigCache=new Map<string,AvatarRig>(),artCache=new Map<string,HTMLCanvasElement>(),faceCache=new Map<string,HTMLCanvasElement>(),outfitCache=new Map<string,HTMLCanvasElement>();
const canvas=(w:number,h:number)=>{const el=document.createElement('canvas');el.width=Math.ceil(w);el.height=Math.ceil(h);return el;};
export const asset=(path:string)=>{let image=sources.get(path);if(!image){image=new Image();image.src=path;image.onload=()=>{rigCache.clear();artCache.clear();faceCache.clear();outfitCache.clear();window.dispatchEvent(new Event('brasa-art-loaded'));};sources.set(path,image);}return image;};
const modular=asset('/assets/character-base.png');
const modularDependencies=['/assets/shop-accessories.png','/assets/hair-wavy.png','/assets/hair-covered-atlas.png','/assets/outfit-surfer-body.png','/assets/outfit-executive-body.png'];
export const ENABLE_MODULAR_APPEARANCE:boolean=false;
/** Never reveal an unfinished bald base while the painted layers are loading. */
export const modularAppearanceReady=()=>ENABLE_MODULAR_APPEARANCE&&modular.complete&&modular.naturalWidth>0&&modularDependencies.every(path=>{const image=asset(path);return image.complete&&image.naturalWidth>0;});
/** Validated complete costumes load independently of the unfinished hair/hat rollout. */
export const PAINTED_OUTFITS:Readonly<Record<string,{source:readonly[number,number,number,number];destination:readonly[number,number,number,number];portrait:readonly[number,number,number,number];hue:number}>>={
 'outfit-surfer':{source:[340,350,710,890],destination:[362,484,593,743],portrait:[340,350,710,890],hue:.51},
 'outfit-racer':{source:[100,65,490,745],destination:[430,575,431,656],portrait:[100,65,490,745],hue:.61},
 'outfit-dancer':{source:[740,75,420,730],destination:[455,585,378,657],portrait:[740,75,420,730],hue:.97},
 'outfit-executive':{source:[415,405,460,830],destination:[470,555,373,673],portrait:[415,405,460,830],hue:.64},
 'outfit-cartographer':{source:[240,8,775,904],destination:[340,610,542,630],portrait:[240,8,775,904],hue:.61}
};
export const paintedOutfitReady=(id:string)=>{const path=CATALOG[id]?.visual?.asset;if(!PAINTED_OUTFITS[id]||!path)return false;const image=asset(path);return image.complete&&image.naturalWidth>0;};
type Point=readonly[number,number];
export interface AvatarPart {canvas:HTMLCanvasElement;x:number;y:number;width:number;height:number;pivot:Point;}
export interface WalkingLeg {thigh:AvatarPart;shin:AvatarPart;foot:AvatarPart;hip:Point;knee:Point;ankle:Point;groundY:number;}
export interface WalkingRig {torso:AvatarPart;near:WalkingLeg;far:WalkingLeg;}
export interface CombatRig {torso:AvatarPart;nearLeg:AvatarPart;farLeg:AvatarPart;neck:Point;arms?:AvatarPart;hand?:Point;}
export interface AvatarRig {combat?:CombatRig;head:AvatarPart;stanceBody:AvatarPart;walking?:WalkingRig;modular:boolean;paintedOutfit:boolean;outfitPose:'surfer'|'executive'|'racer'|'dancer'|'cartographer';neckCloth?:AvatarPart;}
export interface LayerDefinition {anchor:'head'|'chest'|'hands'|'hips'|'feet'|'back'|'world';order:number;bounds:[number,number,number,number];}
/** New assets reuse a slot's anchor; visual.offset/scale/rotation refine individual fits. */
export const AVATAR_LAYERS:Partial<Record<Slot,LayerDefinition>>={
 outfit:{anchor:'chest',order:30,bounds:[-30,-81,60,82]},face:{anchor:'head',order:50,bounds:[-625*AVATAR_UNIT,-1225*AVATAR_UNIT,160,160]},hair:{anchor:'head',order:54,bounds:[-625*AVATAR_UNIT,-1225*AVATAR_UNIT,160,160]},glasses:{anchor:'head',order:52,bounds:[-10,-111,42,25]},hat:{anchor:'head',order:56,bounds:[-46,-169,94,67]}
};
export function visual(eq:Equipment,slot:Slot):ItemVisual {
 const item=CATALOG[eq[slot]],v=item?.visual??{variant:item?item.id.replace(`${slot}-`,''):'none'};
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
 const outfitId=PAINTED_OUTFITS[eq.outfit]?eq.outfit:'outfit-surfer',outfit=visual({...eq,outfit:outfitId},'outfit');
 // Loading or stale legacy IDs never reveal a retired outfit. The only fallback is Surfista.
 if(!paintedOutfitReady(outfitId))return null;
 const face=getFacePortrait(CATALOG[eq.face]?.slot==='face'?eq.face:'face-brave'),hairPath=visual(eq,'hair').asset,hair=hairPath?asset(hairPath):null,base=modular;
 // Wait for the universal head instead of briefly showing the retired starter
 // haircut baked into adventurer.png while the selected artwork is loading.
 if(!face||!base.complete||!base.naturalWidth||hair&&(!hair.complete||!hair.naturalWidth))return null;
 const headReady=true;
 const shopOutfit=outfitId==='outfit-racer'||outfitId==='outfit-dancer',cartographer=outfitId==='outfit-cartographer',atlasCombat=shopOutfit||cartographer;
 const body=asset(CATALOG[outfitId].visual!.asset!),walkImage=shopOutfit?asset('/assets/outfits/shop-walking-legs.png'):asset(cartographer?'/assets/outfits/cartographer-walk.png':`/assets/outfits/${outfitId}-walk.png`),walkReady=walkImage.complete&&walkImage.naturalWidth>0;
 const combatImage=atlasCombat?body:asset('/assets/outfits/combat-prone.png'),combatReady=combatImage.complete&&combatImage.naturalWidth>0;
 const key=JSON.stringify([outfitId,base.src,body.src,eq.dyes?.outfit,headReady?eq.face:'original',walkReady,combatReady]);const cached=rigCache.get(key);if(cached){rigCache.delete(key);rigCache.set(key,cached);return cached;}
 const registration=PAINTED_OUTFITS[outfitId],source=canvas(SIZE*RESOLUTION,SIZE*RESOLUTION),c=source.getContext('2d')!;
 c.scale(RESOLUTION,RESOLUTION);c.drawImage(body,...registration.source,...registration.destination);
 const dyed=eq.dyes?.outfit&&eq.dyes.outfit!=='original';if(dyed)tint(source,outfit.color!,ctx=>ctx.rect(0,0,SIZE,SIZE),1,registration.hue);
 const headSource=canvas(SIZE*RESOLUTION,SIZE*RESOLUTION);headSource.getContext('2d')!.drawImage(headReady?face!:base,0,0,headSource.width,headSource.height);
 const surfer=outfitId==='outfit-surfer';
 const rig:AvatarRig={modular:headReady,paintedOutfit:true,outfitPose:outfitId.replace('outfit-','') as AvatarRig['outfitPose'],
  head:cut(headSource,[[265,0],[991,0],[991,600],[727,608],[701,631],[622,629],[542,608],[265,608]],[650,610]),
  stanceBody:cut(source,[[260,460],[1010,460],[1010,1254],[260,1254]],[650,610])};
 if(surfer){
  // Occlude only the neutral atlas's shirt pixels. Skin and the universal head remain unchanged.
  const cloth=canvas(SIZE*RESOLUTION,SIZE*RESOLUTION),cc=cloth.getContext('2d')!;
  cc.drawImage(source,520*RESOLUTION,630*RESOLUTION,90*RESOLUTION,60*RESOLUTION,540*RESOLUTION,578*RESOLUTION,90*RESOLUTION,58*RESOLUTION);
  cc.drawImage(source,730*RESOLUTION,650*RESOLUTION,80*RESOLUTION,60*RESOLUTION,666*RESOLUTION,596*RESOLUTION,70*RESOLUTION,40*RESOLUTION);
  const pixels=cc.getImageData(0,0,cloth.width,cloth.height),headPixels=headSource.getContext('2d')!.getImageData(0,0,cloth.width,cloth.height).data;
  for(let y=0;y<cloth.height;y++)for(let x=0;x<cloth.width;x++){const i=(y*cloth.width+x)*4,r=headPixels[i],g=headPixels[i+1],b=headPixels[i+2];const isShirt=y>=580*RESOLUTION&&y<631*RESOLUTION&&x>=540*RESOLUTION&&x<736*RESOLUTION&&g>r*.87&&b>r*.71;pixels.data[i+3]=isShirt?Math.min(pixels.data[i+3],headPixels[i+3]):0;}
  cc.putImageData(pixels,0,0);rig.neckCloth=cut(cloth,[[535,575],[741,575],[741,635],[535,635]],[650,610]);
 }
 if(cartographer){
  // The universal face includes a short neck. Bring the painted standing
  // collar/lapels forward so this outfit does not leave a long bare neck.
  // The inset cravat is sampled from the same atlas painting, not a flat fill.
  const cloth=canvas(SIZE*RESOLUTION,SIZE*RESOLUTION),cc=cloth.getContext('2d')!;cc.drawImage(source,0,0);
  cc.save();cc.scale(RESOLUTION,RESOLUTION);cc.beginPath();polygon(cc,[[662,627],[723,639],[723,685],[681,705],[646,681]]);cc.clip();
  cc.drawImage(body,704,74,60,96,645,620,80,86);cc.restore();
  rig.neckCloth=cut(cloth,[[560,605],[745,605],[770,710],[530,710]],[650,610]);
 }
 if(walkReady){
  const legs=canvas(SIZE*RESOLUTION,SIZE*RESOLUTION),lc=legs.getContext('2d')!;lc.scale(RESOLUTION,RESOLUTION);
  if(cartographer)lc.drawImage(walkImage,47,162,713,1009,390,820,495,420);
  else if(shopOutfit)lc.drawImage(walkImage,...(outfitId==='outfit-racer'?[210,0,620,870]:[1070,0,505,870]) as [number,number,number,number],...(outfitId==='outfit-racer'?[480,790,340,440]:[545,790,245,440]) as [number,number,number,number]);else if(surfer)lc.drawImage(walkImage,450,675,500,540,500,818,380,410);else lc.drawImage(walkImage,415,405,500,830,470,555,405,673);
  if(dyed)tint(legs,outfit.color!,ctx=>ctx.rect(0,0,SIZE,SIZE),1,registration.hue);
  const makeLeg=(hip:Point,knee:Point,ankle:Point,thigh:readonly Point[],shin:readonly Point[],foot:readonly Point[]):WalkingLeg=>{
   const paintedFoot=cut(legs,foot,ankle),pixels=paintedFoot.canvas.getContext('2d')!.getImageData(0,0,paintedFoot.canvas.width,paintedFoot.canvas.height).data;let lastRow=0;
   for(let i=3;i<pixels.length;i+=4)if(pixels[i]>16)lastRow=Math.max(lastRow,Math.floor(i/4/paintedFoot.canvas.width));
   return {hip,knee,ankle,groundY:paintedFoot.y+(lastRow+1)/RESOLUTION,thigh:cut(legs,thigh,hip),shin:cut(legs,shin,knee),foot:paintedFoot};
  };
  const walkingTorso=shopOutfit||cartographer?canvas(SIZE*RESOLUTION,SIZE*RESOLUTION):source;
  if(shopOutfit||cartographer){const tc=walkingTorso.getContext('2d')!;tc.drawImage(source,0,0);if(cartographer){
   // Keep the painted asymmetric coat tails attached to the torso, while only
   // the trouser/boot silhouettes below the belt become articulated legs.
   tc.clearRect(505*RESOLUTION,850*RESOLUTION,348*RESOLUTION,404*RESOLUTION);
  }else{tc.clearRect(0,800*RESOLUTION,SIZE*RESOLUTION,SIZE*RESOLUTION);tc.drawImage(legs,0,0);}}
  rig.walking=cartographer?{
   torso:cut(walkingTorso,[[260,460],[1010,460],[1010,1254],[260,1254]],[650,610]),
   near:makeLeg([610,870],[595,1020],[580,1155],[[505,850],[715,850],[715,1050],[505,1050]],[[495,1000],[720,1000],[720,1170],[495,1170]],[[480,1110],[725,1110],[725,1240],[480,1240]]),
   far:makeLeg([770,870],[772,1020],[790,1155],[[700,850],[895,850],[895,1050],[700,1050]],[[685,1000],[900,1000],[900,1170],[685,1170]],[[680,1110],[900,1110],[900,1240],[680,1240]])
  }:shopOutfit?{
   torso:cut(walkingTorso,[[400,540],[880,540],[880,880],[400,880]],[650,610]),
   near:makeLeg([605,875],[585,1025],[580,1145],[[430,870],[650,870],[650,1045],[430,1045]],[[430,1005],[650,1005],[650,1165],[430,1165]],[[430,1110],[650,1110],[650,1254],[430,1254]]),
   far:makeLeg([710,875],[720,1025],[720,1145],[[650,870],[850,870],[850,1045],[650,1045]],[[650,1005],[850,1005],[850,1165],[650,1165]],[[650,1110],[850,1110],[850,1254],[650,1254]])
  }:{
   torso:cut(source,surfer?[[260,460],[1010,460],[1010,826],[823,900],[787,896],[741,826],[646,822],[623,902],[487,855],[430,800],[260,800]]:[[380,540],[920,540],[920,875],[792,891],[742,878],[686,907],[636,918],[549,895],[500,875],[380,875]],[650,610]),
   near:surfer?makeLeg([615,885],[590,1025],[590,1141],[[510,887],[616,912],[682,840],[682,1046],[510,1046]],[[510,1004],[680,1004],[680,1164],[510,1164]],[[510,1118],[690,1118],[690,1240],[510,1240]]):makeLeg([622,886],[615,1025],[615,1133],[[555,853],[683,853],[683,1045],[555,1045]],[[555,1005],[681,1005],[681,1152],[555,1152]],[[550,1105],[669,1105],[672,1143],[718,1165],[718,1240],[550,1240]]),
   far:surfer?makeLeg([752,885],[755,1025],[755,1141],[[683,840],[780,840],[826,902],[870,910],[870,1046],[683,1046]],[[695,1004],[880,1004],[880,1164],[695,1164]],[[695,1118],[895,1118],[895,1240],[695,1240]]):makeLeg([735,886],[735,1025],[735,1133],[[683,853],[805,853],[805,1045],[683,1045]],[[682,1005],[810,1005],[810,1152],[682,1152]],[[680,1105],[810,1105],[810,1145],[872,1170],[872,1240],[680,1240]])
  };
 }
 if(combatReady){
  const prone=canvas(SIZE*RESOLUTION,SIZE*RESOLUTION),pc=prone.getContext('2d')!;pc.scale(RESOLUTION,RESOLUTION);
  pc.drawImage(combatImage,...(cartographer?[101,926,1055,317]:shopOutfit?(outfitId==='outfit-racer'?[25,880,600,265]:[640,905,590,245]):surfer?[25,380,990,350]:[1040,380,970,350]) as [number,number,number,number],201,1018,560,220);
  if(dyed)tint(prone,outfit.color!,ctx=>ctx.rect(0,0,SIZE,SIZE),1,registration.hue);
  // Compact chibi combat body: the unchanged universal head occupies ~75% of total height.
  const point=(p:Point):Point=>[201+(p[0]-80)*560/856,1018+(p[1]-918)*220/300];
  const cutProne=(points:readonly Point[],pivot:Point)=>cut(prone,points.map(point),point(pivot));
  const hip:Point=[492,1112],neck:Point=surfer?[766,942]:[777,944];
  rig.combat={neck:point(neck),
   torso:cutProne([[480,900],[1010,900],[1010,1254],[480,1254]],neck),
   farLeg:cutProne([[60,900],[526,900],[526,1092],[360,1118],[150,1088],[60,1088]],hip),
   nearLeg:cutProne([[60,1080],[155,1080],[362,1108],[526,1080],[526,1254],[60,1254]],hip)
  };
 }
 if(atlasCombat&&combatReady&&rig.combat){
  const prone=canvas(SIZE*RESOLUTION,SIZE*RESOLUTION),pc=prone.getContext('2d')!;pc.scale(RESOLUTION,RESOLUTION);
  pc.drawImage(body,...(cartographer?[101,926,1055,317]:outfitId==='outfit-racer'?[25,880,600,265]:[640,905,590,245]) as [number,number,number,number],...(cartographer?[180,1018,650,195]:[201,1018,560,220]) as [number,number,number,number]);
  if(dyed)tint(prone,outfit.color!,ctx=>ctx.rect(0,0,SIZE,SIZE),1,registration.hue);
  const neck:Point=cartographer?[765,1040]:outfitId==='outfit-racer'?[680,1040]:[690,1040],hip:Point=cartographer?[465,1130]:[450,1130];
  rig.combat=cartographer?{neck,
   torso:cut(prone,[[475,1010],[850,1010],[850,1220],[475,1220]],neck),
   farLeg:cut(prone,[[180,1010],[490,1010],[490,1135],[180,1135]],hip),
   nearLeg:cut(prone,[[180,1115],[500,1115],[500,1230],[180,1230]],hip)
  }:{neck,torso:cut(prone,[[440,1000],[780,1000],[780,1254],[440,1254]],neck),farLeg:cut(prone,[[180,1000],[460,1000],[460,1125],[180,1125]],hip),nearLeg:cut(prone,[[180,1125],[460,1125],[460,1254],[180,1254]],hip)};
 }
 if(rig.combat)splitProneArms(rig.combat);
 rigCache.set(key,rig);if(rigCache.size>32)rigCache.delete(rigCache.keys().next().value!);return rig;
}
/** Universal prone arms. Every painted prone body lies with its forearms and
 * fists on the ground ahead of the chest, so the front-lower part of the torso
 * silhouette is lifted into its own layer for crawling and throwing. The box
 * comes from the torso's own alpha, not per-outfit numbers, so a new outfit
 * painted on the prone template works without coordinates. See docs/prone-combat.md. */
export const PRONE_ARMS={left:.42,top:.58,shoulder:.3,hand:[.9,.86] as Point};
function splitProneArms(combat:CombatRig){
 const torso=combat.torso,tc=torso.canvas.getContext('2d',{willReadFrequently:true})!,{width,height}=torso.canvas,data=tc.getImageData(0,0,width,height).data;
 let left=width,right=-1,top=height,bottom=-1;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>24){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
 if(right<left||bottom<top)return;
 const L=torso.x+left/RESOLUTION,R=torso.x+(right+1)/RESOLUTION,T=torso.y+top/RESOLUTION,B=torso.y+(bottom+1)/RESOLUTION,at=([u,v]:Point):Point=>[L+(R-L)*u,T+(B-T)*v];
 const [x0,y0]=at([PRONE_ARMS.left,PRONE_ARMS.top]),arms=canvas(width,height),ac=arms.getContext('2d')!;
 const local=(x:number,y:number)=>[(x-torso.x)*RESOLUTION,(y-torso.y)*RESOLUTION] as const,[lx,ly]=local(x0,y0);
 ac.drawImage(torso.canvas,lx,ly,width-lx,height-ly,lx,ly,width-lx,height-ly);
 // Lifting the forearms leaves the chest above them intact; the head covers the shoulder seam.
 tc.clearRect(lx,ly,width-lx,height-ly);
 // The arms swing from the shoulder, just under the universal neck pivot.
 combat.arms={canvas:arms,x:torso.x,y:torso.y,width:torso.width,height:torso.height,pivot:[combat.neck[0],combat.neck[1]+(B-T)*PRONE_ARMS.shoulder]};
 combat.hand=at(PRONE_ARMS.hand);
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
/** Inventory uses the exact registered full-body painting, including gloves and boots. */
export function getOutfitPortrait(id:string):HTMLCanvasElement|null {
 const item=CATALOG[id];if(item?.slot!=='outfit'||!PAINTED_OUTFITS[id]||!item.visual?.asset)return null;
 const image=asset(item.visual.asset);
 if(!image.complete||!image.naturalWidth)return null;
 const known=outfitCache.get(id);if(known)return known;
 const out=canvas(512,768),c=out.getContext('2d')!,crop=PAINTED_OUTFITS[id].portrait;
 const ratio=Math.min(488/crop[2],744/crop[3]),width=crop[2]*ratio,height=crop[3]*ratio;
 c.drawImage(image,crop[0],crop[1],crop[2],crop[3],(out.width-width)/2,(out.height-height)/2,width,height);
 outfitCache.set(id,out);return out;
}
/** Painted hair and glasses cut from an atlas; their inventory icons use the same region. */
export const PAINTED_ACCESSORIES:Readonly<Record<string,ArtRegion>>=Object.fromEntries(Object.entries(COSMETIC_MANIFEST).flatMap(([id,manifest])=>manifest.slot!=='hat'&&manifest.worn&&manifest.worn.source[2]!==SIZE?[[id,manifest.worn]]:[]));
export function getAccessoryPortrait(id:string,color?:string):HTMLCanvasElement|null {
 const registration=PAINTED_ACCESSORIES[id];if(!registration)return null;
 const img=asset(registration.atlas);if(!img.complete||!img.naturalWidth)return null;const known=artCache.get(`portrait:${id}:${color??''}`);if(known)return known;
 const out=cutRegion(img,registration),c=out.getContext('2d',{willReadFrequently:true})!,[w,h]=[out.width,out.height];if(color){const pixels=c.getImageData(0,0,w,h),{h:targetHue,s:targetSaturation}=hsl(color);for(let i=0;i<pixels.data.length;i+=4)if(pixels.data[i+3])recolor(pixels.data,i,targetHue,targetSaturation);c.putImageData(pixels,0,0);}
 if(id==='glasses-navigator'){
  // The painted cyan lenses are translucent in the game. Preserve the gold
  // rims, temples and bright white glints while showing the full face below.
  const [x,y]=registration.source,pixels=c.getImageData(0,0,w,h),data=pixels.data;
  for(let row=0;row<h;row++)for(let col=0;col<w;col++){
   const px=col+x,py=row+y,near=((px-640)/214)**2+((py-680)/159)**2<1,far=((px-1087)/103)**2+((py-700)/135)**2<1;
   if(!near&&!far)continue;
   const index=(row*w+col)*4,r=data[index],g=data[index+1],b=data[index+2];
   if(data[index+3]>0&&b>165&&g>135&&b>r*1.07&&g>r*.94)data[index+3]=Math.round(data[index+3]*.45);
  }
  c.putImageData(pixels,0,0);
 }
 artCache.set(`portrait:${id}:${color??''}`,out);return out;
}
const headPoint=([x,y]:Point):Point=>[(x-625)*AVATAR_UNIT,(y-1225)*AVATAR_UNIT];
const nearEye=headPoint(FACE_REGISTRATION.sockets.leftEye),farEye=headPoint(FACE_REGISTRATION.sockets.rightEye);
function drawGlasses(c:CanvasRenderingContext2D,v:ItemVisual,time:number){layer(c,v,()=>{
 // The manifest pins each lens's optical centre to the universal eye sockets.
 const registration=COSMETIC_MANIFEST[`glasses-${v.variant}`]?.worn;if(registration){
  const translucent=v.variant==='navigator'?getAccessoryPortrait('glasses-navigator'):null;if(translucent){drawPinned(c,translucent,registration,true);return;}
  const img=asset(registration.atlas);if(img.complete&&img.naturalWidth)drawPinned(c,img,registration);return;
 }
 const pilot=v.variant==='pilot';c.strokeStyle=shade(v.color!,.5);c.lineWidth=pilot?2.2:1.35;const glass=c.createLinearGradient(0,-111,0,-88);glass.addColorStop(0,pilot?'#70b7cf80':'#e5fcff12');glass.addColorStop(1,'#72c6da16');
 for(const [x,y,rx,ry]of [[...nearEye,8.4,8.5],[...farEye,5.8,6.9]]){ellipse(c,x,y,rx,ry,glass,v.color);c.strokeStyle='#f6edc9';c.lineWidth=.65;c.beginPath();c.ellipse(x,y,rx-.8,ry-.8,0,Math.PI,Math.PI*1.7);c.stroke();}
 c.strokeStyle=v.color!;c.lineWidth=1.4;c.beginPath();c.moveTo(nearEye[0]+8,nearEye[1]);c.quadraticCurveTo(14,-102,farEye[0]-5.5,farEye[1]-1);c.moveTo(nearEye[0]-8,nearEye[1]-2);c.lineTo(-15,-99);c.stroke();c.globalAlpha=.25+Math.sin(time/700)*.15;c.strokeStyle='#e7ffff';c.beginPath();c.moveTo(-1,-105);c.lineTo(5,-100);c.moveTo(20,-101);c.lineTo(24,-97);c.stroke();
 });}
// Open goggles and the guard helmet retain their existing local drawings.
function drawHat(c:CanvasRenderingContext2D,eq:Equipment){const v=visual(eq,'hat');layer(c,v,()=>{
 if(v.variant==='pilot'){c.translate(1,-124);c.scale(.8,.8);c.rotate(-.105);c.strokeStyle='#35251f44';c.lineWidth=10;c.beginPath();c.moveTo(-35,-1);c.quadraticCurveTo(0,-12,32,-1);c.stroke();c.strokeStyle='#77533d';c.lineWidth=7;c.beginPath();c.moveTo(-35,-4);c.quadraticCurveTo(0,-15,32,-4);c.stroke();const g=material(c,v.color!);ellipse(c,-12,-4,14,10,g,'#68462e');ellipse(c,15,-3,12,9,g,'#68462e');ellipse(c,-12,-4,10,6.7,'#5798b4','#f3d595');ellipse(c,15,-3,8.5,5.8,'#5798b4','#f3d595');c.strokeStyle='#d5f5ff';c.lineWidth=1.5;c.beginPath();c.moveTo(-18,-5);c.lineTo(-10,-8);c.moveTo(10,-4);c.lineTo(17,-6);c.stroke();}
 else if(v.variant==='knight'){c.translate(-3,-116);c.scale(.85,.85);c.rotate(.025);ellipse(c,0,9,35,8,'#25313a44');c.fillStyle=material(c,v.color!);c.strokeStyle=shade(v.color!,.48);c.lineWidth=1.7;c.beginPath();c.moveTo(-36,9);c.quadraticCurveTo(-42,-43,0,-41);c.quadraticCurveTo(37,-42,36,9);c.lineTo(21,1);c.lineTo(1,-5);c.lineTo(-21,5);c.closePath();c.fill();c.stroke();c.strokeStyle='#eff9e0aa';c.lineWidth=1.5;c.beginPath();c.moveTo(-29,-10);c.quadraticCurveTo(-23,-34,2,-34);c.stroke();c.fillStyle='#b8555c';c.beginPath();c.moveTo(-5,-38);c.quadraticCurveTo(-17,-64,21,-57);c.quadraticCurveTo(6,-49,6,-38);c.fill();}
 });}
function drawHair(c:CanvasRenderingContext2D,eq:Equipment,hair:ItemVisual){
 const registered=PAINTED_ACCESSORIES[eq.hair];if(registered){const img=getAccessoryPortrait(eq.hair,eq.dyes?.hair&&eq.dyes.hair!=='original'?hair.color:undefined);if(img)drawPinned(c,aroundEar(img,registered),registered,true);return;}
 if(!hair.asset)return;
 const dyed=eq.dyes?.hair&&eq.dyes.hair!=='original',art=tintedArt(hair.asset,dyed?hair.color:undefined);
 if(art){const region=COSMETIC_MANIFEST[eq.hair]?.worn??onTemplate(hair.asset);drawPinned(c,aroundEar(art,region),region,true);}
}
function coveredHair(eq:Equipment,hair:ItemVisual){
 const registration=COSMETIC_MANIFEST[eq.hair]?.covered;if(!registration)return null;
 const img=asset(registration.atlas);if(!img.complete||!img.naturalWidth)return null;
 const dye=eq.dyes?.hair&&eq.dyes.hair!=='original'?hair.color:eq.hair==='hair-silver'?hair.color:undefined;
 const key=`covered:${eq.hair}:${dye??'original'}`;let out=artCache.get(key);if(out)return out;
 const [x,y,w,h]=registration.source;out=canvas(w,h);const c=out.getContext('2d')!;c.drawImage(img,x,y,w,h,0,0,w,h);
 if(dye){const pixels=c.getImageData(0,0,w,h),{h:targetHue,s:targetSaturation}=hsl(dye);for(let i=0;i<pixels.data.length;i+=4)if(pixels.data[i+3])recolor(pixels.data,i,targetHue,targetSaturation);c.putImageData(pixels,0,0);}
 artCache.set(key,out);return out;
}
function drawCoveredHair(c:CanvasRenderingContext2D,eq:Equipment,hair:ItemVisual,front:boolean){
 const registration=COSMETIC_MANIFEST[eq.hair]?.covered,art=coveredHair(eq,hair);if(!art||!registration)return;
 c.save();
 if(front){
  // The nape and low ponytail belong behind the universal face/neck. Only the
  // authored fringe and temple area pass in front; the hat brim is drawn last.
  c.beginPath();polygon(c,[[425,130],[920,130],[920,515],[700,515],[600,470],[425,460]].map(p=>headPoint(p as [number,number])));c.clip();
 }
 drawPinned(c,aroundEar(underHat(art,registration),registration),registration,true);c.restore();
}
/** Rear equipment follows exactly the head transform in standing and combat rigs. */
export function drawHeadRearLayers(c:CanvasRenderingContext2D,eq:Equipment,_time:number,_emotion:string,isModular:boolean){
 const hair=visual(eq,'hair'),hat=visual(eq,'hat');
 if(isModular&&hair.variant!=='none'&&!hat.hideHair&&getHeadwearProfile(eq)==='covered')layer(c,hair,()=>drawCoveredHair(c,eq,hair,false));
}
/** Front order: fringe, then glasses (a paid item always stays visible), then the hat brim. */
/** Maps template points into the pixels of pre-cut art placed by drawPinned (its inverse). */
function artSpace(art:HTMLCanvasElement,region:ArtRegion){
 const {source:[sx,sy,sw,sh],pin:{from:[a,b],to:[A,B]}}=region;
 const dx=b[0]-a[0],dy=b[1]-a[1],tx=B[0]-A[0],ty=B[1]-A[1],den=dx*dx+dy*dy,p=(tx*dx+ty*dy)/den,q=(ty*dx-tx*dy)/den,k=p*p+q*q;
 const sxScale=art.width/sw,syScale=art.height/sh;
 return {toArt:([x,y]:Point):Point=>{const X=x-A[0],Y=y-A[1];return[((p*X+q*Y)/k+a[0]-sx)*sxScale,((p*Y-q*X)/k+a[1]-sy)*syScale];},pixelsPerUnit:sxScale/Math.sqrt(k)};
}
const earCuts=new WeakMap<HTMLCanvasElement,HTMLCanvasElement>(),hatCuts=new WeakMap<HTMLCanvasElement,HTMLCanvasElement>();
/** Hair art with the near ear cut out and the cut edge inked like the head's own outline, so the
 * universal ear shows through and the hair wraps around it as in DDTank. */
function aroundEar(art:HTMLCanvasElement,region:ArtRegion){
 const known=earCuts.get(art);if(known)return known;
 const {toArt,pixelsPerUnit}=artSpace(art,region);
 const out=canvas(art.width,art.height),c=out.getContext('2d')!;c.drawImage(art,0,0);
 c.beginPath();EAR_FRONT.forEach((point,i)=>i?c.lineTo(...toArt(point)):c.moveTo(...toArt(point)));c.closePath();
 c.globalCompositeOperation='destination-out';c.fill();
 // Half of the stroke lands on the remaining hair only: a dark rim that continues the ear outline.
 c.globalCompositeOperation='source-atop';c.strokeStyle='#260803';c.lineJoin=c.lineCap='round';c.lineWidth=5*pixelsPerUnit;c.stroke();
 earCuts.set(art,out);return out;
}
/** Under a hat only what hangs below its band shows, as in DDTank: hair above the seat line is
 * erased, and behind the head the cut curves down the skull so no tuft pokes past the crown and
 * nape hair looks tucked under the hat. */
function underHat(art:HTMLCanvasElement,region:ArtRegion){
 const known=hatCuts.get(art);if(known)return known;
 const {toArt,pixelsPerUnit}=artSpace(art,region),[[bx,by],[fx,fy]]=HEAD_ANCHORS.hatSeat,seatY=(x:number)=>by+(x-bx)*(fy-by)/(fx-bx)-HAT_TUCK;
 const out=canvas(art.width,art.height),c=out.getContext('2d')!;c.drawImage(art,0,0);
 const back=seatY(bx),hidden:Point[]=[[-SIZE,-SIZE],[2*SIZE,-SIZE],[2*SIZE,seatY(2*SIZE)],[bx,back],...HAT_NAPE.map(([x,y]):Point=>[bx-x,back+y]),[-SIZE,back+HAT_NAPE[HAT_NAPE.length-1][1]]];
 c.globalCompositeOperation='destination-out';c.filter=`blur(${HAT_SOFT*pixelsPerUnit}px)`;
 c.beginPath();hidden.forEach((point,i)=>i?c.lineTo(...toArt(point)):c.moveTo(...toArt(point)));c.closePath();c.fill();
 hatCuts.set(art,out);return out;
}
/** Template units: how far above the seat line the band hides the cut, the softness of its edge,
 * and the cut behind the head (back, down from the band's rear corner), rounded like the skull. */
const HAT_TUCK=10,HAT_SOFT=4,HAT_NAPE:readonly Point[]=[[0,-45],[45,-38],[90,-18],[130,15],[165,60],[190,120]];
export function drawHeadLayers(c:CanvasRenderingContext2D,eq:Equipment,time:number,_emotion:string,isModular:boolean){
 const hair=visual(eq,'hair'),hat=visual(eq,'hat');
 if(isModular&&hair.variant!=='none'&&!hat.hideHair)layer(c,hair,()=>getHeadwearProfile(eq)==='covered'?drawCoveredHair(c,eq,hair,true):drawHair(c,eq,hair));
 drawGlasses(c,visual(eq,'glasses'),time);
 if(!drawWornHat(c,eq))drawHat(c,eq);
}
