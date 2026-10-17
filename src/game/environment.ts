import {getMap,MATERIALS} from '../../shared/maps';
import type {EnvironmentObject,EnvironmentQuality,MapDefinition,MapId,Shape} from '../../shared/maps';
import {ground,solid,terrainCols,terrainTemplate,WORLD} from '../../shared/physics';

/** W×H is the view; a map's world may be wider (`dimensions.width`) and the camera scrolls across it. */
const W=WORLD.width,H=WORLD.height,TAU=Math.PI*2,TERRAIN_SCALE=2,MID_OFFSET=60;
/** Art direction: dim only the distant/parallax painting, never the playfield. */
export const PARALLAX_SHADE_ALPHA=.14;
const images=new Map<string,HTMLImageElement>();
const decodedImages=new WeakMap<HTMLImageElement,Promise<boolean>>();
function loadImage(src:string){let image=images.get(src);if(!image){image=new Image();image.decoding='async';image.src=src;images.set(src,image);decodedImages.set(image,image.decode().then(()=>true,()=>false));}return image;}
const preloadedMaps=new Map<MapId,Promise<boolean>>();
/** Decode before entering a map; callers may prefetch while its room is open. */
export function preloadEnvironment(map:MapId):Promise<boolean>{
 const def=getMap(map),cached=preloadedMaps.get(def.id);if(cached)return cached;
 const sources=[def.art.background??def.art.midground,...def.art.mid?[def.art.mid]:[],def.art.terrain??`/assets/maps/${def.id}-terrain.png`,def.art.props,getMap('garden').art.props];
 const ready=Promise.all([...new Set(sources)].map(src=>decodedImages.get(loadImage(src))!)).then(results=>results.every(Boolean));preloadedMaps.set(def.id,ready);return ready;
}
let quality:EnvironmentQuality='high';
try{const value=localStorage.getItem('brasa-environment-quality');if(value==='low'||value==='medium'||value==='high')quality=value;}catch{}
export function getEnvironmentQuality(){return quality;}
export function setEnvironmentQuality(value:EnvironmentQuality){quality=value;try{localStorage.setItem('brasa-environment-quality',value);}catch{}}
const count=(low:number,medium:number,high:number)=>quality==='low'?low:quality==='medium'?medium:high;
function random(seed:number){return ((Math.sin(seed*127.1+311.7)*43758.5453)%1+1)%1;}
function hex(color:string){return [parseInt(color.slice(1,3),16),parseInt(color.slice(3,5),16),parseInt(color.slice(5,7),16)];}
function gradient(c:CanvasRenderingContext2D,y:number,height:number,a:string,b:string){const g=c.createLinearGradient(0,y,0,y+height);g.addColorStop(0,a);g.addColorStop(1,b);return g;}
function ellipse(c:CanvasRenderingContext2D,x:number,y:number,rx:number,ry:number,color:string){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fill();}
function shapePath(c:CanvasRenderingContext2D,shape:Shape){c.beginPath();if(shape.kind==='cells')c.rect(shape.col*3,shape.row*3,shape.cols*3,shape.rows*3);else if(shape.kind==='rect')c.rect(shape.x,shape.y,shape.width,shape.height);else if(shape.kind==='ellipse')c.ellipse(shape.x,shape.y,shape.rx,shape.ry,0,0,TAU);else{shape.points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();}}
interface Bounds {x:number;y:number;width:number;height:number;}
interface CachedLayer extends Bounds {canvas:HTMLCanvasElement;}
function makeCanvas(width:number,height:number){const canvas=document.createElement('canvas');canvas.width=Math.ceil(width);canvas.height=Math.ceil(height);return canvas;}
function smoothImages(c:CanvasRenderingContext2D,filter:ImageSmoothingQuality='high'){c.imageSmoothingEnabled=true;c.imageSmoothingQuality=filter;}
function shapeBounds(shape:Shape):Bounds {
 if(shape.kind==='rect')return shape;
 if(shape.kind==='cells')return {x:shape.col*3,y:shape.row*3,width:shape.cols*3,height:shape.rows*3};
 if(shape.kind==='ellipse')return {x:shape.x-shape.rx,y:shape.y-shape.ry,width:shape.rx*2,height:shape.ry*2};
 const xs=shape.points.map(p=>p[0]),ys=shape.points.map(p=>p[1]),x=Math.min(...xs),y=Math.min(...ys);
 return {x,y,width:Math.max(...xs)-x,height:Math.max(...ys)-y};
}
// Bounds include animated excursions. They are visual only and never affect collision.
const OBJECT_BOUNDS:Record<EnvironmentObject['kind'],Bounds>={
 tree:{x:-105,y:-170,width:210,height:140},flowers:{x:-65,y:-65,width:130,height:85},fence:{x:-78,y:-55,width:156,height:60},
 fountain:{x:-105,y:-145,width:210,height:155},butterfly:{x:-10,y:-10,width:20,height:20},ferris:{x:-158,y:-158,width:316,height:350},
 carousel:{x:-120,y:-185,width:240,height:215},balloons:{x:-55,y:-135,width:110,height:160},bunting:{x:-5,y:-5,width:470,height:75},
 crystal:{x:-40,y:-105,width:80,height:115},statue:{x:-48,y:-145,width:96,height:155},flag:{x:-8,y:-160,width:115,height:165},
 crate:{x:-24,y:-57,width:48,height:61},barrel:{x:-25,y:-59,width:50,height:63}
};
function objectBounds(o:EnvironmentObject):Bounds {const b=OBJECT_BOUNDS[o.kind];return {x:o.x+b.x*o.scale,y:o.y+b.y*o.scale,width:b.width*o.scale,height:b.height*o.scale};}
function intersects(a:Bounds,b:Bounds){return a.x+a.width>=b.x&&a.x<=b.x+b.width&&a.y+a.height>=b.y&&a.y<=b.y+b.height;}
function cameraBounds(camera:CameraState,depth=1):Bounds {
 const zoom=1+(camera.zoom-1)*Math.min(1,depth),width=W/zoom,height=H/zoom;
 return {x:W/2+(camera.x-W/2)*depth-width/2,y:H/2+(camera.y-H/2)*depth-height/2,width,height};
}
/** Six isolated painted props, trimmed once and resampled once per display size. */
class PropAtlas {
 private image:HTMLImageElement;private cells:HTMLCanvasElement[]=[];private scaled=new Map<string,HTMLCanvasElement>();
 constructor(src:string){this.image=loadImage(src);}
 ready(){
  if(this.cells.length)return true;if(!this.image.complete||!this.image.naturalWidth)return false;
  const width=Math.floor(this.image.naturalWidth/3),height=Math.floor(this.image.naturalHeight/2),source=makeCanvas(width,height),ctx=source.getContext('2d',{willReadFrequently:true})!;
  for(let slot=0;slot<6;slot++){
   ctx.clearRect(0,0,width,height);ctx.drawImage(this.image,(slot%3)*width,Math.floor(slot/3)*height,width,height,0,0,width,height);
   const imageData=ctx.getImageData(0,0,width,height),pixels=imageData.data;let left=width,top=height,right=0,bottom=0;
   for(let y=0;y<height;y++)for(let x=0;x<width;x++){const alpha=(y*width+x)*4+3;if(pixels[alpha]>16){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}else pixels[alpha]=0;}
   ctx.putImageData(imageData,0,0);
   if(right<left||bottom<top){this.cells.push(makeCanvas(1,1));continue;}
   left=Math.max(0,left-2);top=Math.max(0,top-2);right=Math.min(width-1,right+2);bottom=Math.min(height-1,bottom+2);
   const cell=makeCanvas(right-left+1,bottom-top+1);cell.getContext('2d')!.drawImage(source,left,top,cell.width,cell.height,0,0,cell.width,cell.height);this.cells.push(cell);
  }return true;
 }
 draw(c:CanvasRenderingContext2D,slot:number,x:number,y:number,width:number,height:number,stretch=false,bottomAligned=false){
  if(!this.ready())return false;const key=`${slot}:${width}:${height}:${stretch}:${bottomAligned}`;let canvas=this.scaled.get(key);
  if(!canvas){canvas=makeCanvas(width*2,height*2);const source=this.cells[slot],ctx=canvas.getContext('2d')!,scale=Math.min(canvas.width/source.width,canvas.height/source.height),w=stretch?canvas.width:source.width*scale,h=stretch?canvas.height:source.height*scale;ctx.drawImage(source,(canvas.width-w)/2,(canvas.height-h)/(bottomAligned?1:2),w,h);this.scaled.set(key,canvas);}
  c.drawImage(canvas,x,y,width,height);return true;
 }
}
const propAtlases=new Map<string,PropAtlas>();
function props(src:string){let atlas=propAtlases.get(src);if(!atlas){atlas=new PropAtlas(src);propAtlases.set(src,atlas);}return atlas;}
const registeredTerrain=new WeakMap<HTMLImageElement,HTMLCanvasElement>();
function registerTerrainArt(image:HTMLImageElement,map:MapId){
 const cached=registeredTerrain.get(image);if(cached)return cached;
 const width=getMap(map).dimensions.width,raw=makeCanvas(width,H),rc=raw.getContext('2d',{willReadFrequently:true})!;rc.drawImage(image,0,0,width,H);
 // Collision traced from this very painting (`npm run build:map`) already matches it pixel for pixel.
 if(getMap(map).regions.every(region=>region.shape.kind==='cells')){registeredTerrain.set(image,raw);return raw;}
 const rgba=rc.getImageData(0,0,W,H).data,template=terrainTemplate(map),objects=new Set(getMap(map).objects.map(o=>o.region).filter(Boolean));
 let sourceLeft=W,sourceRight=0,targetLeft=W,targetRight=0;
 const top=new Float64Array(W).fill(H),bottom=new Float64Array(W);
 for(let y=350;y<H;y++)for(let x=0;x<W;x++)if(rgba[(y*W+x)*4+3]>160){sourceLeft=Math.min(sourceLeft,x);sourceRight=Math.max(sourceRight,x);}
 for(let x=0;x<W;x++)for(let cy=0;cy<WORLD.rows;cy++){
  const i=cy*WORLD.cols+Math.floor(x/3),region=template.definition[template.regions[i]];
  if(template.solid[i]&&region&&!objects.has(region.id)){top[x]=Math.min(top[x],cy*3);bottom[x]=Math.max(bottom[x],cy*3+3);targetLeft=Math.min(targetLeft,x);targetRight=Math.max(targetRight,x);}
 }
 if(sourceRight<=sourceLeft)return raw;
 const normalized=makeCanvas(W,H),nc=normalized.getContext('2d',{willReadFrequently:true})!;
 nc.drawImage(raw,sourceLeft,0,sourceRight-sourceLeft+1,H,targetLeft,0,targetRight-targetLeft+1,H);
 const pixels=nc.getImageData(0,0,W,H).data,sourceTop=new Float64Array(W).fill(H),sourceBottom=new Float64Array(W);
 for(let x=targetLeft;x<=targetRight;x++)for(let y=350;y<H;y++)if(pixels[(y*W+x)*4+3]>160){sourceTop[x]=Math.min(sourceTop[x],y);sourceBottom[x]=y+1;}
 // Containers and crystal obelisks have their own collision masks/atlas sprites;
 // they must not pull the terrain's walkable rim upward during UV registration.
 for(const region of template.definition)if(objects.has(region.id)){
  const bounds=shapeBounds(region.shape),left=Math.max(targetLeft,Math.floor(bounds.x)-24),right=Math.min(targetRight,Math.ceil(bounds.x+bounds.width)+24);
  for(let x=left;x<=right;x++)sourceTop[x]=sourceTop[left]+(sourceTop[right]-sourceTop[left])*(x-left)/Math.max(1,right-left);
 }
 const valid=Array.from({length:targetRight-targetLeft+1},(_,i)=>targetLeft+i).filter(x=>top[x]<H&&sourceTop[x]<H&&sourceBottom[x]>sourceTop[x]);
 const sourceMean=valid.reduce((sum,x)=>sum+sourceTop[x],0)/valid.length,targetMean=valid.reduce((sum,x)=>sum+top[x],0)/valid.length;
 const scale=Math.max(.8,Math.min(1.2,(Math.max(...bottom)-targetMean)/(Math.max(...sourceBottom)-sourceMean)));
 const smooth=(values:Float64Array,x:number,radius:number)=>{let sum=0,n=0;for(let dx=-radius;dx<=radius;dx++){const xx=Math.max(targetLeft,Math.min(targetRight,x+dx));if(values[xx]<H){sum+=values[xx];n++;}}return sum/Math.max(1,n);};
 const output=makeCanvas(W,H),ctx=output.getContext('2d')!;
 for(let x=targetLeft;x<=targetRight;x++){
  if(top[x]>=H||sourceBottom[x]<=sourceTop[x])continue;
  // Smooth UVs, rather than the three-pixel collision staircase, preserve the
  // painted architecture. A common vertical scale avoids rippling its details.
  const sourceRim=smooth(sourceTop,x,24),targetRim=smooth(top,x,9);
  ctx.drawImage(normalized,x,0,1,H,x,targetRim-sourceRim*scale,1,H*scale);
 }
 if(getMap(map).id==='park')for(let x=targetLeft;x<=targetRight;x++){
  const targetRuns:[number,number][]=[],sourceRuns:[number,number][]=[];let start=-1;
  for(let y=0;y<=H;y++){const i=Math.floor(y/3)*WORLD.cols+Math.floor(x/3),occupied=y<H&&template.solid[i]&&!objects.has(template.definition[template.regions[i]]?.id);if(occupied&&start<0)start=y;if(!occupied&&start>=0){targetRuns.push([start,y]);start=-1;}}
  if(targetRuns.length!==2)continue;
  for(let y=Math.floor(sourceTop[x]);y<=H;y++){const occupied=y<H&&pixels[(y*W+x)*4+3]>128;if(occupied&&start<0)start=y;if(!occupied&&start>=0){if(y-start>15)sourceRuns.push([start,y]);start=-1;}}
  if(sourceRuns.length<2)continue;const source=sourceRuns.slice(-2);ctx.clearRect(x,0,1,H);
  for(let n=0;n<2;n++)ctx.drawImage(normalized,x,source[n][0],1,source[n][1]-source[n][0],x,targetRuns[n][0],1,targetRuns[n][1]-targetRuns[n][0]);
 }
 // Extrude painted edge colours into tiny registration gaps. The collision mask
 // still owns the silhouette; no flat placeholder material should peek through.
 const aligned=ctx.getImageData(0,0,W,H),colours=aligned.data,original=colours.slice();
 for(let x=targetLeft;x<=targetRight;x++)for(let y=top[x];y<bottom[x];y++){
  const p=(y*W+x)*4,i=Math.floor(y/3)*WORLD.cols+Math.floor(x/3);if(!template.solid[i]||objects.has(template.definition[template.regions[i]]?.id)||colours[p+3]>200)continue;
  for(let radius=1;radius<90;radius++){
   let found=-1;for(const [xx,yy] of [[x,y-radius],[x,y+radius],[x-radius,y],[x+radius,y]])if(xx>=0&&xx<W&&yy>=0&&yy<H&&original[(yy*W+xx)*4+3]>230){found=(yy*W+xx)*4;break;}
   if(found>=0){for(let channel=0;channel<3;channel++)colours[p+channel]=original[found+channel];colours[p+3]=255;break;}
  }
 }ctx.putImageData(aligned,0,0);
 registeredTerrain.set(image,output);return output;
}
export interface CameraState {x:number;y:number;zoom:number;targetZoom:number;targetX:number;targetY:number;worldWidth:number;}
export function createCamera(worldWidth=W):CameraState{return {x:W/2,y:H/2,zoom:1,targetZoom:1,targetX:W/2,targetY:H/2,worldWidth};}
export function zoomCamera(camera:CameraState,delta:number,map:MapDefinition){camera.targetZoom=Math.max(map.camera.minZoom,Math.min(map.camera.maxZoom,camera.targetZoom+delta));}
export function updateCamera(camera:CameraState,x:number,y:number){
 camera.zoom+=(camera.targetZoom-camera.zoom)*.09;
 const hw=W/(2*camera.zoom),hh=H/(2*camera.zoom);
 const right=camera.worldWidth??W;camera.targetX=Math.max(hw,Math.min(right-hw,x));camera.targetY=Math.max(hh,Math.min(H-hh,y));
 camera.x+=(camera.targetX-camera.x)*.075;camera.y+=(camera.targetY-camera.y)*.075;
 camera.x=Math.max(hw,Math.min(right-hw,camera.x));camera.y=Math.max(hh,Math.min(H-hh,camera.y));
}
export function applyCamera(c:CanvasRenderingContext2D,camera:CameraState,depth=1){
 const zoom=1+(camera.zoom-1)*Math.min(1,depth);
 c.translate(W/2,H/2);c.scale(zoom,zoom);c.translate(-W/2-(camera.x-W/2)*depth,-H/2-(camera.y-H/2)*depth);
}

/** Terrain artwork is masked by exactly the same cells the authoritative simulation uses. */
export function paintTerrain(data:Uint8Array,map:MapId,texture?:CanvasImageSource,worldArt?:CanvasImageSource):HTMLCanvasElement {
 const def=getMap(map),W=def.dimensions.width,COLS=W/WORLD.cell,template=terrainTemplate(map),small=document.createElement('canvas');small.width=COLS;small.height=WORLD.rows;
 const s=small.getContext('2d')!,pixels=s.createImageData(COLS,WORLD.rows);
 for(let i=0;i<data.length;i++){if(!data[i])continue;const region=template.definition[template.regions[i]];if(!region)continue;const color=hex(MATERIALS[region.material].color),x=i%COLS,y=Math.floor(i/COLS),noise=(random(x+y*19)-.5)*13;const edge=y===0||!data[i-COLS];
  for(let n=0;n<3;n++)pixels.data[i*4+n]=color[n]+noise+(edge?25:0);pixels.data[i*4+3]=255;
 }s.putImageData(pixels,0,0);
 // A 2x coverage buffer filters the *same* 3px simulation cells. It affects only
 // fractional edge coverage; no collision, material index or replay byte changes.
 const canvas=makeCanvas(W*TERRAIN_SCALE,H*TERRAIN_SCALE),c=canvas.getContext('2d')!;c.scale(TERRAIN_SCALE,TERRAIN_SCALE);smoothImages(c);c.drawImage(small,0,0,W,H);
 c.save();c.globalCompositeOperation='source-atop';
 // A painted world layer follows the authored geometry at its original aspect
 // ratio. Only the authoritative cell mask changes after a hit.
 if(worldArt)c.drawImage(worldArt,0,0,W,H);
 else if(texture){c.globalAlpha=.94;c.drawImage(texture,0,470,W,415);c.globalAlpha=1;}
 else{c.fillStyle=gradient(c,530,300,'#f4d0a22d','#2b23414f');c.fillRect(0,450,W,H);}
 // Every material keeps its own hue and texture; masonry stays distinct in hybrid maps.
 for(const region of def.regions){
  if(worldArt||region.surface==='wood')continue;c.save();shapePath(c,region.shape);c.clip();
  if(region.material==='sand'){c.fillStyle='#efd19a55';c.fillRect(0,0,W,H);}else if(region.material==='magic'){c.fillStyle='#8f90e84a';c.fillRect(0,0,W,H);}
  if(region.surface==='paving'||region.surface==='marble'){
   c.fillStyle=gradient(c,530,260,region.material==='metal'?'#8a91a4':'#f5e8d0',region.material==='metal'?'#464858':'#9b94b4');c.fillRect(0,0,W,H);
   if(texture&&def.id==='celestial'){c.globalAlpha=.85;c.drawImage(texture,0,510,W,350);c.globalAlpha=1;}
   c.lineWidth=1.5;c.strokeStyle='#514f6b64';for(let row=0;row<11;row++){const yy=546+row*23;c.beginPath();c.moveTo(0,yy);c.lineTo(W,yy);c.stroke();for(let xx=(row%2)*42;xx<W;xx+=84){c.beginPath();c.moveTo(xx,yy);c.lineTo(xx,yy+23);c.stroke();}}
   c.strokeStyle='#fff0ca6b';c.lineWidth=2;shapePath(c,region.shape);c.stroke();
  }c.restore();
 }
 // Roots, pebbles and mineral veins are clipped to remaining soil, including crater edges.
 c.lineCap='round';for(let n=0;n<(worldArt?0:95);n++){const x=random(n+10)*W,y=610+random(n+400)*210;
  if(def.id!=='celestial'){c.strokeStyle=n%2?'#7451324d':'#efc19045';c.lineWidth=2+random(n)*4;c.beginPath();c.moveTo(x,y);c.bezierCurveTo(x-15,y+8,x+8,y+21,x-13,y+35);c.stroke();}
 }
 if(worldArt){
  // A soft shadow of the removed cells shades fractures inside the remaining
  // terrain. Per-cell strokes used to overwrite antialiasing with opaque steps.
  const fracture=makeCanvas(COLS,WORLD.rows),fc=fracture.getContext('2d')!,edge=fc.createImageData(COLS,WORLD.rows);let damaged=false;
  for(let i=0;i<data.length;i++)if(template.solid[i]&&!data[i]){edge.data[i*4+3]=255;damaged=true;}
  if(damaged){
   // Generic broken edge, the same for every weapon: a short cool shade inside
   // the cut and a thin light lip on the surviving cells, never a burnt halo.
   fc.putImageData(edge,0,0);c.shadowColor='rgba(14,18,34,.62)';c.shadowBlur=4*TERRAIN_SCALE;c.drawImage(fracture,0,0,W,H);c.shadowBlur=0;
   const lip=makeCanvas(COLS,WORLD.rows),lc=lip.getContext('2d')!,rim=lc.createImageData(COLS,WORLD.rows);
   const removed=(i:number)=>i>=0&&i<data.length&&template.solid[i]===1&&!data[i];
   for(let i=0;i<data.length;i++){if(!data[i])continue;const x=i%COLS;
    if(removed(i-COLS)||(x>0&&removed(i-1))||(x<COLS-1&&removed(i+1))||removed(i+COLS)){rim.data[i*4]=rim.data[i*4+1]=rim.data[i*4+2]=255;rim.data[i*4+3]=removed(i-COLS)?210:120;}}
   lc.putImageData(rim,0,0);c.drawImage(lip,0,0,W,H);
  }
 }
 c.restore();
 if(worldArt)return canvas;
 // An irregular illustrated rim follows ALL exposed upward faces, rather than a fixed band.
 for(let x=0;x<COLS;x++)for(let y=1;y<WORLD.rows;y++){
  const i=y*COLS+x;if(!data[i]||data[i-COLS])continue;const region=template.definition[template.regions[i]];if(!region||region.surface==='wood')continue;
  const px=x*3,py=y*3,isOriginal=template.solid[i-COLS]===0;
  if(worldArt&&isOriginal)continue;
  c.lineWidth=3;c.strokeStyle=isOriginal&&region.surface==='grass'?'#416f40':isOriginal?'#f8edcc':'#593e45';c.beginPath();c.moveTo(px,py+1);c.lineTo(px+3,py+1);c.stroke();
  if(isOriginal&&region.surface==='grass'&&x%2===0){const h=4+random(x)*8;c.strokeStyle=x%3?'#7ba85a':'#b9ce76';c.lineWidth=1.7;c.beginPath();c.moveTo(px,py+1);c.quadraticCurveTo(px-2,py-h*.6,px-4+random(x+1)*7,py-h);c.stroke();
   if(x%17===0){const col=['#f8d4d9','#efe6ac','#cfbce9'][x%3];for(let p=0;p<5;p++)ellipse(c,px+Math.cos(p*TAU/5)*3,py-8+Math.sin(p*TAU/5)*3,2.5,2.2,col);ellipse(c,px,py-8,1.7,1.7,'#e7ad5c');}
  }
 }
 return canvas;
}

export class EnvironmentRenderer {
 readonly definition:MapDefinition;readonly width:number;private mid?:HTMLImageElement;private data:Uint8Array;private terrain:HTMLCanvasElement;private terrainDrawing:HTMLCanvasElement;private art:HTMLImageElement;private texture?:HTMLImageElement;private worldArt?:HTMLImageElement;private preview:HTMLImageElement;
 private loadState:'loading'|'ready'|'error'='loading';private preparation:Promise<boolean>;
 private objectLayers=new Map<string,CachedLayer>();private layers=new Map<string,HTMLCanvasElement>();private camera=createCamera();private objectQuality=quality;
 private props:PropAtlas;private gardenProps:PropAtlas;private propsRevision='';
 constructor(map:MapId,data:Uint8Array){
  this.definition=getMap(map);this.width=this.definition.dimensions.width;this.data=data;if(this.definition.art.mid)this.mid=loadImage(this.definition.art.mid);this.preview=loadImage(`/assets/maps/${this.definition.id}-preview.png`);this.art=loadImage(this.definition.art.midground);
  if(this.definition.art.terrain)this.worldArt=loadImage(this.definition.art.terrain);else this.texture=loadImage(`/assets/maps/${this.definition.id}-terrain.png`);
  this.props=props(this.definition.art.props);this.gardenProps=props(getMap('garden').art.props);this.terrain=makeCanvas(this.width*TERRAIN_SCALE,H*TERRAIN_SCALE);this.terrainDrawing=makeCanvas(this.width,H);
  this.preparation=preloadEnvironment(map).then(ready=>{if(!ready){this.loadState='error';return false;}this.props.ready();this.gardenProps.ready();this.loadState='ready';this.setTerrain(this.data);return true;}).catch(()=>{this.loadState='error';return false;});
 }
 isReady(){return this.loadState==='ready';}
 whenReady(){return this.preparation;}
 setTerrain(data:Uint8Array){
  this.data=data;if(!this.isReady())return;
  this.terrain=paintTerrain(data,this.definition.id,this.texture,this.worldArt?registerTerrainArt(this.worldArt,this.definition.id):undefined);this.objectLayers.clear();
  // Static grounded props share the terrain snapshot. Compositing their separate
  // GPU canvases every frame can force repeated raster synchronization in Chromium.
  const c=this.terrain.getContext('2d')!;c.save();c.setTransform(TERRAIN_SCALE,0,0,TERRAIN_SCALE,0,0);
  for(const object of this.definition.objects)if(object.layer===5&&(object.region||!object.animated))this.drawObject(c,object,0,true);
  c.restore();this.objectLayers.clear();
  // Resolve supersampled coverage once at the artwork's native world resolution.
  // Re-filtering the full 2x surface on every pan is expensive in software Canvas.
  this.terrainDrawing=makeCanvas(this.width,H);const resolved=this.terrainDrawing.getContext('2d')!;smoothImages(resolved);resolved.drawImage(this.terrain,0,0,this.width,H);
 }
 getTerrainLayer(){return this.terrain;}
 private cached(key:string,width:number,height:number,paint:(c:CanvasRenderingContext2D)=>void){
  let layer=this.layers.get(key);if(!layer){layer=makeCanvas(width,height);paint(layer.getContext('2d')!);this.layers.set(key,layer);}return layer;
 }
 drawBack(c:CanvasRenderingContext2D,time:number,camera:CameraState){
  this.camera=camera;const m=this.definition;
  // High-quality resizing belongs in the caches. Bilinear presentation keeps
  // their antialiased coverage while avoiding a costly bicubic pass every frame.
  smoothImages(c,'low');if(!this.isReady()){this.drawLoading(c);return;}
  if(m.art.background){this.drawBackdrop(c,camera);return;}
  const propsRevision=`${this.props.ready()}:${this.gardenProps.ready()}`;
  if(propsRevision!==this.propsRevision){this.propsRevision=propsRevision;this.objectLayers.clear();this.layers.delete('landscape');}
  c.drawImage(this.cached('sky',W,H,ctx=>{ctx.fillStyle=gradient(ctx,0,H,m.lighting.sky,m.lighting.horizon);ctx.fillRect(0,0,W,H);}),0,0);
  c.save();applyCamera(c,camera,.08);
  c.drawImage(this.cached('sun',480,480,ctx=>{const sun=ctx.createRadialGradient(240,240,10,240,240,235);sun.addColorStop(0,m.id==='park'?'#fff2ddc0':'#fffcebbb');sun.addColorStop(.2,'#fff6e665');sun.addColorStop(1,'#fff6e600');ctx.fillStyle=sun;ctx.fillRect(0,0,480,480);}),880,-110);
  for(let i=0;i<count(3,5,7);i++){const x=((i*307+time*(.003+i%3*.001))%(W+400))-200,y=75+i%4*62;this.cloud(c,x,y,95+i%4*18,m.id==='park'?.3:.8,.08);}c.restore();
  c.save();applyCamera(c,camera,.22);
  c.drawImage(this.cached('landscape',W,H,ctx=>{
   if(m.id==='celestial'){for(let i=0;i<4;i++){const x=75+i*425,y=320+Math.sin(i*3)*80;ctx.globalAlpha=.65;this.props.draw(ctx,2,x-65,y-90,140+i%2*45,135+i%2*45);}ctx.globalAlpha=1;}
   else{ctx.globalAlpha=m.id==='park'?.16:.48;for(let i=0;i<3;i++)this.gardenProps.draw(ctx,3,100+i*520,290+i%2*60,330,100);ctx.globalAlpha=1;}
  }),0,0);c.restore();
  c.save();applyCamera(c,camera,.55);
  if(this.art.complete&&this.art.naturalWidth){const {x,y,width,height}=m.art.midgroundRect??{x:-42,y:m.id==='celestial'?-10:18,width:W+84,height:m.id==='celestial'?605:555};c.drawImage(this.cached('near',width,height,ctx=>ctx.drawImage(this.art,0,0,width,height)),x,y);}
  for(const object of m.objects)if(object.layer===3)this.drawObject(c,object,time);
  c.restore();
  c.save();c.fillStyle=`rgba(7,13,24,${PARALLAX_SHADE_ALPHA})`;c.fillRect(0,0,W,H);c.restore();
 }
 drawTerrain(c:CanvasRenderingContext2D,time:number){
  if(!this.isReady())return;
  // Keep the resampling filter's neighbourhood outside the viewport: changing
  // the integer crop during a subpixel pan must not expose its sampling edge.
  const visible=cameraBounds(this.camera),padding=8,x=Math.max(0,Math.floor(visible.x)-padding),y=Math.max(0,Math.floor(visible.y)-padding),right=Math.min(this.width,Math.ceil(visible.x+visible.width)+padding),bottom=Math.min(H,Math.ceil(visible.y+visible.height)+padding);
  if(right>x&&bottom>y)c.drawImage(this.terrainDrawing,x,y,right-x,bottom-y,x,y,right-x,bottom-y);
  for(const object of this.definition.objects)if(object.layer===5){
   if(object.animated&&!object.region)this.drawObject(c,object,time);
   else if(object.kind==='crystal')this.crystalGlint(c,object,time);
  }
 }
 drawFront(c:CanvasRenderingContext2D,time:number,camera:CameraState){
  if(!this.isReady()){this.drawLoading(c);return;}
  c.save();applyCamera(c,camera,1.12);
  for(const object of this.definition.objects)if(object.layer===6)this.drawObject(c,object,time);
  if(this.definition.id==='celestial')for(let i=0;i<count(2,3,4);i++)this.cloud(c,-100+((i*491+time*.012)%(W+400)),865+i%3*15,230,.62,1.12);
  c.restore();c.save();applyCamera(c,camera,.85);this.atmosphere(c,time);c.restore();
 }
 /** A single painted backdrop, cover-fitted to the bottom edge so its abyss sits under the playfield. It barely drifts with the camera. */
 private drawBackdrop(c:CanvasRenderingContext2D,camera:CameraState){
  const image=this.art,margin=48,depth=.1;if(!image.naturalWidth)return;
  const travel=(this.width-W)*depth,layer=this.cached('backdrop',W+travel+margin*2,H+margin*2,ctx=>{const width=W+travel+margin*2,scale=Math.max(width/image.naturalWidth,(H+margin*2)/image.naturalHeight),height=image.naturalHeight*scale;smoothImages(ctx);ctx.drawImage(image,(width-image.naturalWidth*scale)/2,H+margin*2-height,image.naturalWidth*scale,height);});
  c.save();applyCamera(c,camera,depth);c.drawImage(layer,-margin,-margin);c.restore();
  const mid=this.mid;
  if(mid?.naturalWidth){
   // Painted mid-distance band, tiled across the world, between backdrop and terrain.
   const midDepth=.5,height=H,width=mid.naturalWidth*height/mid.naturalHeight,tile=this.cached('mid',width,height,ctx=>{smoothImages(ctx);ctx.drawImage(mid,0,0,width,height);});
   c.save();applyCamera(c,camera,midDepth);const view=cameraBounds(camera,midDepth);
   // Every other copy is mirrored, so neighbouring edges always match.
   for(let x=Math.floor(view.x/width)*width;x<view.x+view.width;x+=width){if(Math.round(x/width)%2){c.save();c.translate(x+width,MID_OFFSET);c.scale(-1,1);c.drawImage(tile,0,0);c.restore();}else c.drawImage(tile,x,MID_OFFSET);}c.restore();
  }
  c.save();c.fillStyle=`rgba(7,13,24,${PARALLAX_SHADE_ALPHA})`;c.fillRect(0,0,W,H);c.restore();
 }
 private drawLoading(c:CanvasRenderingContext2D){
  c.save();c.globalAlpha=1;c.fillStyle=this.definition.lighting.sky;c.fillRect(0,0,W,H);
  if(this.preview.complete&&this.preview.naturalWidth){const p=this.preview,share=W/this.width;c.drawImage(p,p.naturalWidth*(1-share)/2,0,p.naturalWidth*share,p.naturalHeight,0,0,W,H);}
  c.fillStyle='#08132999';c.fillRect(0,0,W,H);c.textAlign='center';c.fillStyle='#fff3ce';c.font='600 24px sans-serif';
  c.fillText(this.loadState==='error'?'Não foi possível carregar o cenário. Recarregue para tentar novamente.':'Preparando cenário…',W/2,H/2);c.restore();
 }
 private cloud(c:CanvasRenderingContext2D,x:number,y:number,size:number,alpha:number,depth:number){
  const b={x:x-size,y:y-size*.32,width:size*2,height:size*.64};if(!intersects(b,cameraBounds(this.camera,depth)))return;
  c.save();c.globalAlpha=alpha;(this.definition.id==='celestial'?this.props:this.gardenProps).draw(c,3,b.x,b.y,b.width,b.height);c.restore();
 }
 private drawObject(c:CanvasRenderingContext2D,o:EnvironmentObject,time:number,baking=false){
  if(o.kind==='fence'||o.kind==='statue'||o.kind==='flag')o={...o,y:ground(this.data,o.x)};
  if(this.objectQuality!==quality){this.objectLayers.clear();this.objectQuality=quality;}
  const visual=objectBounds(o),depth=o.layer===3?.55:o.layer===6?1.12:1;
  if(!baking&&!intersects(visual,cameraBounds(this.camera,depth)))return;
  // Solid scenery artwork is clipped by the authoritative material mask; damaged crates never remain as invisible blockers.
  if(o.region||!o.animated){let layer=this.objectLayers.get(o.id);if(!layer){
    const template=terrainTemplate(this.definition.id),region=template.definition.findIndex(r=>r.id===o.region),b=region<0?visual:shapeBounds(template.definition[region].shape);
    const x=Math.floor(b.x/3)*3-3,y=Math.floor(b.y/3)*3-3,width=Math.ceil((b.x+b.width-x)/3)*3+3,height=Math.ceil((b.y+b.height-y)/3)*3+3,canvas=makeCanvas(width*TERRAIN_SCALE,height*TERRAIN_SCALE),ctx=canvas.getContext('2d')!;
    ctx.scale(TERRAIN_SCALE,TERRAIN_SCALE);smoothImages(ctx);ctx.translate(-x,-y);this.object(ctx,o,0);ctx.setTransform(TERRAIN_SCALE,0,0,TERRAIN_SCALE,0,0);
    if(region>=0){const mask=makeCanvas(width/3,height/3),mc=mask.getContext('2d')!,im=mc.createImageData(mask.width,mask.height);
     for(let cy=0;cy<mask.height;cy++)for(let cx=0;cx<mask.width;cx++){const tx=x/3+cx,ty=y/3+cy,i=ty*terrainCols(this.data)+tx;if(tx>=0&&ty>=0&&tx<terrainCols(this.data)&&ty<WORLD.rows&&this.data[i]&&template.regions[i]===region)im.data[(cy*mask.width+cx)*4+3]=255;}
     mc.putImageData(im,0,0);ctx.globalCompositeOperation='destination-in';ctx.drawImage(mask,0,0,width,height);
    }layer={canvas,x,y,width,height};this.objectLayers.set(o.id,layer);
   }c.drawImage(layer.canvas,layer.x,layer.y,layer.width,layer.height);
   if(o.kind==='crystal'&&!baking)this.crystalGlint(c,o,time);return;
  }
  this.object(c,o,time);
 }
 private crystalGlint(c:CanvasRenderingContext2D,o:EnvironmentObject,time:number){
  if(!solid(this.data,o.x,o.y-16)||quality==='low'||!intersects(objectBounds(o),cameraBounds(this.camera)))return;
  c.save();c.globalAlpha=.55+Math.sin(time/700)*.25;c.strokeStyle='#8ceeff';c.lineWidth=1;c.beginPath();c.moveTo(o.x-4,o.y-36);c.lineTo(o.x+4,o.y-36);c.moveTo(o.x,o.y-40);c.lineTo(o.x,o.y-32);c.stroke();c.restore();
 }
 private object(c:CanvasRenderingContext2D,o:EnvironmentObject,time:number){
  c.save();c.translate(o.x,o.y);c.scale(o.scale,o.scale);const t=time/1000;
  if(o.kind==='ferris')this.ferris(c,t);
  else if(o.kind==='carousel')this.carousel(c,t);
  else if(o.kind==='fountain')fountain(c,t);
  else if(o.kind==='flag'){c.rotate(Math.sin(t*1.3+o.x)*.009);this.props.draw(c,4,-5,-154,100,154,false,true);}
  else if(o.kind==='balloons')balloons(c,t);
  else if(o.kind==='bunting')bunting(c,t);
  else if(o.kind==='statue')this.props.draw(c,0,-47,-144,94,144,false,true);
  else if(o.kind==='crystal'){c.globalAlpha=.94+Math.sin(t*1.2)*.06;this.props.draw(c,1,-39,-98,78,101);}
  else if(o.kind==='crate'||o.kind==='barrel'){
   if(!this.gardenProps.draw(c,o.kind==='crate'?4:5,o.kind==='crate'?-19:-21,o.kind==='crate'?-52:-56,o.kind==='crate'?38:42,o.kind==='crate'?52:56,true)&&!(this.worldArt?.complete&&this.worldArt.naturalWidth))container(c,o.kind);
  }
  else if(o.kind==='flowers'){c.transform(1,0,Math.sin(t*.8+o.x)*.025,1,0,0);this.gardenProps.draw(c,1,-64,-68,128,80);}
  else if(o.kind==='fence')this.gardenProps.draw(c,0,-76,-65,152,65,false,true);
  // The generated canopy carries fine leaf detail; a handful of animated leaves gives it motion.
  else if(o.kind==='tree'){for(let i=0;i<count(4,8,13);i++){c.save();c.translate(Math.sin(i*2.1)*75,-100+Math.cos(i*1.3)*55);c.rotate(Math.sin(t*.8+i)*.12+i);ellipse(c,0,0,10,3.6,this.definition.id==='garden'?'#b4d69191':'#a2d3b691');c.restore();}}
  c.restore();
 }
 private ferris(c:CanvasRenderingContext2D,t:number){
  if(!this.props.ready())return;const rotation=t*.055,radius=123;
  this.props.draw(c,1,-84,-8,168,194);
  c.save();c.rotate(rotation);this.props.draw(c,0,-138,-138,276,276);c.restore();
  for(let i=0;i<12;i++){const a=i*TAU/12+rotation;this.props.draw(c,2,Math.cos(a)*radius-18,Math.sin(a)*radius+2,36,42);}
 }
 private carousel(c:CanvasRenderingContext2D,t:number){
  if(!this.props.ready())return;
  this.props.draw(c,4,-113,-31,226,58,true);
  c.fillStyle=gradient(c,-130,130,'#ffe49a','#9d5720');c.fillRect(-5,-135,10,119);
  const horses=Array.from({length:7},(_,i)=>{const a=i*TAU/7+t*.3;return {i,x:Math.cos(a)*76,depth:Math.sin(a)};}).sort((a,b)=>a.depth-b.depth);
  for(const horse of horses){
   const y=-42+horse.depth*8+Math.sin(t*1.8+horse.i)*6;c.save();c.globalAlpha=.78+(horse.depth+1)*.11;
   c.strokeStyle='#f2c052';c.lineWidth=2;c.beginPath();c.moveTo(horse.x,-112);c.lineTo(horse.x,y+8);c.stroke();
   c.translate(horse.x,y);c.scale(horse.depth>0?1:-1,1);this.props.draw(c,5,-26,-59,52,62);c.restore();
  }
  this.props.draw(c,3,-119,-183,238,105,true);
 }
 private atmosphere(c:CanvasRenderingContext2D,time:number){
  const m=this.definition,n=count(12,28,48),t=time/1000,visible=cameraBounds(this.camera,.85);
  if(m.theme==='snow'){
   // Soft snowfall across the whole world, a little denser near the camera.
   const flakes=Math.round(count(30,60,100)*this.width/W);c.save();c.fillStyle='#ffffff';
   for(let i=0;i<flakes;i++){const fall=14+random(i+7)*22,x=(random(i+80)*this.width+Math.sin(t*.6+i)*18+t*6)%this.width,y=((random(i+190)*(H+40)+t*fall)%(H+40))-20;
    if(!intersects({x:x-4,y:y-4,width:8,height:8},visible))continue;c.globalAlpha=.35+random(i+3)*.45;ellipse(c,x,y,1.2+random(i+11)*2.2,1.2+random(i+11)*2.2,'#ffffff');}
   c.restore();return;
  }
  for(let i=0;i<n;i++){
   const x=(random(i+80)*W+t*(m.id==='park'?5:9+i%4))%W,y=80+((random(i+190)*590+t*(m.id==='garden'?7:3))%590);if(!intersects({x:x-8,y:y-8,width:16,height:16},visible))continue;c.save();c.translate(x,y);c.rotate(t*.7+i);c.globalAlpha=.3+Math.sin(t+i)*.16;
   if(m.id==='garden'){ellipse(c,0,0,3+i%3,1.5+i%2,i%3?'#ff66ba':'#ffe452');}
   else if(m.id==='park'){c.fillStyle=['#ffcf35','#fa489b','#36e0d0'][i%3];c.fillRect(-2,-2,3+i%3,5);}
   else{c.strokeStyle=i%3?'#72e7ff':'#ffd76b';c.lineWidth=1;c.beginPath();c.moveTo(-3,0);c.lineTo(3,0);c.moveTo(0,-3);c.lineTo(0,3);c.stroke();}c.restore();
  }
  if(m.id==='garden')for(let i=0;i<count(1,3,5);i++){const x=250+i*246+Math.sin(t*.5+i)*52,y=360+Math.sin(t*.8+i*2)*42;if(!intersects({x:x-10,y:y-10,width:20,height:20},visible))continue;c.save();c.translate(x,y);const wing=Math.abs(Math.sin(t*9+i))*6+1;ellipse(c,-wing/2,-2,wing,4,i%2?'#dfb0f0':'#f4d58e');ellipse(c,wing/2,-2,wing,4,i%2?'#dfb0f0':'#f4d58e');c.fillStyle='#7d6580';c.fillRect(-1,-3,2,7);c.restore();}
 }
}

function fountain(c:CanvasRenderingContext2D,t:number){
 // Fine moving arcs are layered over the illustrated basin.
 c.save();c.translate(-9,-36);c.globalAlpha=.55;c.strokeStyle='#d9f9ff';c.lineWidth=1.8;
 for(let n=0;n<7;n++){const d=(n-3)*15;c.beginPath();c.moveTo(0,-61);c.quadraticCurveTo(d,-83,d*1.7,0);c.stroke();for(let j=0;j<3;j++){const a=(t*.48+j/3+n*.07)%1,x=2*(1-a)*a*d+a*a*d*1.7,y=(1-a)**2*-61+2*(1-a)*a*-83;ellipse(c,x,y,1.5,2,'#edfdff');}}
 for(let i=0;i<3;i++){const a=(t*.4+i/3)%1;c.globalAlpha=(1-a)*.4;c.beginPath();c.ellipse(0,1,12+a*54,3+a*10,0,0,TAU);c.stroke();}c.restore();
}
function balloons(c:CanvasRenderingContext2D,t:number){for(let i=0;i<5;i++){const x=Math.sin(i*2)*19+Math.sin(t+i)*3,y=-70-i%3*19+Math.cos(t+i)*4;c.strokeStyle='#8d7c9d';c.lineWidth=1;c.beginPath();c.moveTo(0,20);c.quadraticCurveTo(x+10,-20,x,y+18);c.stroke();const g=c.createRadialGradient(x-5,y-7,0,x,y,24);g.addColorStop(0,['#ff77ba','#5dffe1','#d696ff','#fff285','#8bdfff'][i]);g.addColorStop(1,['#b61c5a','#0e9d91','#7533bf','#d9890b','#1b6ac5'][i]);ellipse(c,x,y,15,20,g as unknown as string);ellipse(c,x-5,y-8,3,6,'#fff8e77a');}}
function bunting(c:CanvasRenderingContext2D,t:number){c.strokeStyle='#9c7b83';c.lineWidth=2;c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(230,52,460,0);c.stroke();for(let i=0;i<16;i++){const x=i*29+10,y=26*Math.sin(x/460*Math.PI);c.fillStyle=['#ed387a','#ffcc32','#18bea9'][i%3];c.beginPath();c.moveTo(x,y);c.lineTo(x+24,y+2);c.lineTo(x+11+Math.sin(t*2+i)*3,y+24);c.closePath();c.fill();}}
function container(c:CanvasRenderingContext2D,kind:'crate'|'barrel'){c.fillStyle=gradient(c,-54,54,'#cea16b','#78513e');c.strokeStyle='#60483c';c.lineWidth=2;c.beginPath();if(kind==='crate')c.roundRect(-20,-53,40,53,3);else c.ellipse(0,-28,22,28,0,0,TAU);c.fill();c.stroke();c.save();c.clip();for(let x=-19;x<22;x+=9){c.strokeStyle='#6e4e3f';c.beginPath();c.moveTo(x,-55);c.lineTo(x,2);c.stroke();c.strokeStyle='#edc68c6b';c.beginPath();c.moveTo(x+2,-55);c.lineTo(x+2,2);c.stroke();}if(kind==='crate'){c.strokeStyle='#e3b27c';c.lineWidth=7;c.beginPath();c.moveTo(-17,-48);c.lineTo(17,-6);c.moveTo(17,-48);c.lineTo(-17,-6);c.stroke();}else{c.fillStyle='#8e8794';c.fillRect(-26,-44,52,7);c.fillRect(-26,-17,52,7);c.fillStyle='#c9bdc1';c.fillRect(-26,-43,52,2);c.fillRect(-26,-16,52,2);}c.restore();}
