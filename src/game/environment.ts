import {getMap} from '../../shared/maps';
import type {EnvironmentQuality,MapDefinition,MapId} from '../../shared/maps';
import {terrainTemplate,WORLD} from '../../shared/physics';

/** W×H is the view; a map's world may be wider (`dimensions.width`) and the camera scrolls across it. */
const W=WORLD.width,H=WORLD.height,TERRAIN_SCALE=2,MID_OFFSET=60,RIM_CELLS=2;
/** Art direction: dim only the distant/parallax painting, never the playfield. */
export const PARALLAX_SHADE_ALPHA=.14;
const images=new Map<string,HTMLImageElement>();
const decodedImages=new WeakMap<HTMLImageElement,Promise<boolean>>();
function loadImage(src:string){let image=images.get(src);if(!image){image=new Image();image.decoding='async';image.src=src;images.set(src,image);decodedImages.set(image,image.decode().then(()=>true,()=>false));}return image;}
const preloadedMaps=new Map<MapId,Promise<boolean>>();
/** Decode before entering a map; callers may prefetch while its room is open. */
export function preloadEnvironment(map:MapId):Promise<boolean>{
 const def=getMap(map),cached=preloadedMaps.get(def.id);if(cached)return cached;
 const sources=[def.art.background,...def.art.mid?[def.art.mid]:[],def.art.terrain];
 const ready=Promise.all([...new Set(sources)].map(src=>decodedImages.get(loadImage(src))!)).then(results=>results.every(Boolean));preloadedMaps.set(def.id,ready);return ready;
}
let quality:EnvironmentQuality='high';
try{const value=localStorage.getItem('brasa-environment-quality');if(value==='low'||value==='medium'||value==='high')quality=value;}catch{}
export function getEnvironmentQuality(){return quality;}
export function setEnvironmentQuality(value:EnvironmentQuality){quality=value;try{localStorage.setItem('brasa-environment-quality',value);}catch{}}
const count=(low:number,medium:number,high:number)=>quality==='low'?low:quality==='medium'?medium:high;
function random(seed:number){return ((Math.sin(seed*127.1+311.7)*43758.5453)%1+1)%1;}
function ellipse(c:CanvasRenderingContext2D,x:number,y:number,rx:number,ry:number,color:string){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();}
interface Bounds {x:number;y:number;width:number;height:number;}
function makeCanvas(width:number,height:number){const canvas=document.createElement('canvas');canvas.width=Math.ceil(width);canvas.height=Math.ceil(height);return canvas;}
function smoothImages(c:CanvasRenderingContext2D,filter:ImageSmoothingQuality='high'){c.imageSmoothingEnabled=true;c.imageSmoothingQuality=filter;}
function intersects(a:Bounds,b:Bounds){return a.x+a.width>=b.x&&a.x<=b.x+b.width&&a.y+a.height>=b.y&&a.y<=b.y+b.height;}
function cameraBounds(camera:CameraState,depth=1):Bounds {
 const zoom=1+(camera.zoom-1)*Math.min(1,depth),width=W/zoom,height=H/zoom;
 return {x:W/2+(camera.x-W/2)*depth-width/2,y:H/2+(camera.y-H/2)*depth-height/2,width,height};
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

/** The painted terrain with its own antialiased silhouette; only the cells the authoritative
 * simulation has dug out are cut away (collision was traced from this very painting by `npm run build:map`).
 * Masking the untouched outline by 3px cells too would chop its thin painted rim into stairs. */
export function paintTerrain(data:Uint8Array,map:MapId,worldArt:CanvasImageSource):HTMLCanvasElement {
 const def=getMap(map),W=def.dimensions.width,COLS=W/WORLD.cell,template=terrainTemplate(map);
 const canvas=makeCanvas(W*TERRAIN_SCALE,H*TERRAIN_SCALE),c=canvas.getContext('2d')!;c.scale(TERRAIN_SCALE,TERRAIN_SCALE);smoothImages(c);c.drawImage(worldArt,0,0,W,H);
 const fracture=makeCanvas(COLS,WORLD.rows),fc=fracture.getContext('2d')!,edge=fc.createImageData(COLS,WORLD.rows);let damaged=false;
 for(let i=0;i<data.length;i++)if(template.solid[i]&&!data[i]){edge.data[i*4+3]=255;damaged=true;}
 // The painted rim lies in the soft, non-colliding cells just outside the collision; cut it with the dug cells so no sliver floats over a crater.
 const cut=makeCanvas(COLS,WORLD.rows),cc=cut.getContext('2d')!,cutCells=cc.createImageData(COLS,WORLD.rows);
 if(damaged)for(let i=0;i<data.length;i++){if(!edge.data[i*4+3])continue;const x=i%COLS,y=(i-x)/COLS;cutCells.data[i*4+3]=255;
  for(let dy=-RIM_CELLS;dy<=RIM_CELLS;dy++)for(let dx=-RIM_CELLS;dx<=RIM_CELLS;dx++){const nx=x+dx,ny=y+dy,n=ny*COLS+nx;if(nx>=0&&ny>=0&&nx<COLS&&ny<WORLD.rows&&!template.solid[n])cutCells.data[n*4+3]=255;}}
 c.save();
 if(damaged){
  // The 2x buffer filters the *same* 3px simulation cells, so a crater edge has fractional coverage; no collision byte changes.
  fc.putImageData(edge,0,0);cc.putImageData(cutCells,0,0);c.globalCompositeOperation='destination-out';c.drawImage(cut,0,0,W,H);c.globalCompositeOperation='source-atop';
  // Generic broken edge, the same for every weapon: a short cool shade inside
  // the cut and a thin light lip on the surviving cells, never a burnt halo.
  c.shadowColor='rgba(14,18,34,.62)';c.shadowBlur=4*TERRAIN_SCALE;c.drawImage(fracture,0,0,W,H);c.shadowBlur=0;
  const lip=makeCanvas(COLS,WORLD.rows),lc=lip.getContext('2d')!,rim=lc.createImageData(COLS,WORLD.rows);
  const removed=(i:number)=>i>=0&&i<data.length&&template.solid[i]===1&&!data[i];
  for(let i=0;i<data.length;i++){if(!data[i])continue;const x=i%COLS;
   if(removed(i-COLS)||(x>0&&removed(i-1))||(x<COLS-1&&removed(i+1))||removed(i+COLS)){rim.data[i*4]=rim.data[i*4+1]=rim.data[i*4+2]=255;rim.data[i*4+3]=removed(i-COLS)?210:120;}}
  lc.putImageData(rim,0,0);c.drawImage(lip,0,0,W,H);
 }
 c.restore();return canvas;
}

export class EnvironmentRenderer {
 readonly definition:MapDefinition;readonly width:number;private data:Uint8Array;private terrain:HTMLCanvasElement;private terrainDrawing:HTMLCanvasElement;
 private background:HTMLImageElement;private mid?:HTMLImageElement;private worldArt:HTMLImageElement;private preview:HTMLImageElement;
 private loadState:'loading'|'ready'|'error'='loading';private preparation:Promise<boolean>;
 private layers=new Map<string,HTMLCanvasElement>();private camera=createCamera();
 constructor(map:MapId,data:Uint8Array){
  this.definition=getMap(map);this.width=this.definition.dimensions.width;this.data=data;
  this.background=loadImage(this.definition.art.background);if(this.definition.art.mid)this.mid=loadImage(this.definition.art.mid);
  this.worldArt=loadImage(this.definition.art.terrain);this.preview=loadImage(`/assets/maps/${this.definition.id}-preview.png`);
  this.terrain=makeCanvas(this.width*TERRAIN_SCALE,H*TERRAIN_SCALE);this.terrainDrawing=makeCanvas(this.width,H);
  this.preparation=preloadEnvironment(map).then(ready=>{if(!ready){this.loadState='error';return false;}this.loadState='ready';this.setTerrain(this.data);return true;}).catch(()=>{this.loadState='error';return false;});
 }
 isReady(){return this.loadState==='ready';}
 whenReady(){return this.preparation;}
 setTerrain(data:Uint8Array){
  this.data=data;if(!this.isReady())return;
  this.terrain=paintTerrain(data,this.definition.id,this.worldArt);
  // Resolve supersampled coverage once at the artwork's native world resolution.
  // Re-filtering the full 2x surface on every pan is expensive in software Canvas.
  this.terrainDrawing=makeCanvas(this.width,H);const resolved=this.terrainDrawing.getContext('2d')!;smoothImages(resolved);resolved.drawImage(this.terrain,0,0,this.width,H);
 }
 getTerrainLayer(){return this.terrain;}
 private cached(key:string,width:number,height:number,paint:(c:CanvasRenderingContext2D)=>void){
  let layer=this.layers.get(key);if(!layer){layer=makeCanvas(width,height);paint(layer.getContext('2d')!);this.layers.set(key,layer);}return layer;
 }
 /** One painted backdrop, never tiled or repeated: fitted to the bottom edge so its abyss sits under the playfield.
  * A wide panorama scrolls at the depth that shows it exactly once across the map; a narrow one barely drifts. */
 drawBack(c:CanvasRenderingContext2D,_time:number,camera:CameraState){
  this.camera=camera;
  // High-quality resizing belongs in the caches. Bilinear presentation keeps
  // their antialiased coverage while avoiding a costly bicubic pass every frame.
  // Scoped: fighters drawn after this are downscaled ~4x and need mipmapped 'high' filtering, or their edges stair-step.
  c.save();smoothImages(c,'low');
  if(!this.isReady())this.drawLoading(c);
  else{
   this.drawOnce(c,camera,'backdrop',this.background,0);
   if(this.mid)this.drawOnce(c,camera,'mid',this.mid,MID_OFFSET);
   c.fillStyle=`rgba(7,13,24,${PARALLAX_SHADE_ALPHA})`;c.fillRect(0,0,W,H);
  }
  c.restore();
 }
 drawTerrain(c:CanvasRenderingContext2D,_time:number){
  if(!this.isReady())return;
  // Keep the resampling filter's neighbourhood outside the viewport: changing
  // the integer crop during a subpixel pan must not expose its sampling edge.
  const visible=cameraBounds(this.camera),padding=8,x=Math.max(0,Math.floor(visible.x)-padding),y=Math.max(0,Math.floor(visible.y)-padding),right=Math.min(this.width,Math.ceil(visible.x+visible.width)+padding),bottom=Math.min(H,Math.ceil(visible.y+visible.height)+padding);
  if(right>x&&bottom>y)c.drawImage(this.terrainDrawing,x,y,right-x,bottom-y,x,y,right-x,bottom-y);
 }
 drawFront(c:CanvasRenderingContext2D,time:number,camera:CameraState){
  if(!this.isReady()){this.drawLoading(c);return;}
  c.save();applyCamera(c,camera,.85);this.snowfall(c,time);c.restore();
 }
 private drawOnce(c:CanvasRenderingContext2D,camera:CameraState,key:string,image:HTMLImageElement,offset:number){
  if(!image.naturalWidth)return;
  const margin=48,span=this.width-W,fit=(H+margin*2)/image.naturalHeight,natural=image.naturalWidth*fit-W-margin*2;
  const depth=span>0?Math.min(1,Math.max(.1,natural/span)):.1,travel=span*depth,width=W+travel+margin*2;
  const layer=this.cached(key,width,H+margin*2,ctx=>{const scale=Math.max(fit,width/image.naturalWidth),height=image.naturalHeight*scale;smoothImages(ctx);ctx.drawImage(image,(width-image.naturalWidth*scale)/2,H+margin*2-height,image.naturalWidth*scale,height);});
  c.save();applyCamera(c,camera,depth);c.drawImage(layer,-margin,offset-margin);c.restore();
 }
 private drawLoading(c:CanvasRenderingContext2D){
  c.save();c.globalAlpha=1;c.fillStyle=this.definition.lighting.sky;c.fillRect(0,0,W,H);
  if(this.preview.complete&&this.preview.naturalWidth){const p=this.preview,share=W/this.width;c.drawImage(p,p.naturalWidth*(1-share)/2,0,p.naturalWidth*share,p.naturalHeight,0,0,W,H);}
  c.fillStyle='#08132999';c.fillRect(0,0,W,H);c.textAlign='center';c.fillStyle='#fff3ce';c.font='600 24px sans-serif';
  c.fillText(this.loadState==='error'?'Não foi possível carregar o cenário. Recarregue para tentar novamente.':'Preparando cenário…',W/2,H/2);c.restore();
 }
 /** Soft snowfall across the whole world, a little denser near the camera. */
 private snowfall(c:CanvasRenderingContext2D,time:number){
  const t=time/1000,visible=cameraBounds(this.camera,.85),flakes=Math.round(count(30,60,100)*this.width/W);c.save();
  for(let i=0;i<flakes;i++){const fall=14+random(i+7)*22,x=(random(i+80)*this.width+Math.sin(t*.6+i)*18+t*6)%this.width,y=((random(i+190)*(H+40)+t*fall)%(H+40))-20;
   if(!intersects({x:x-4,y:y-4,width:8,height:8},visible))continue;c.globalAlpha=.35+random(i+3)*.45;ellipse(c,x,y,1.2+random(i+11)*2.2,1.2+random(i+11)*2.2,'#ffffff');}
  c.restore();
 }
}
