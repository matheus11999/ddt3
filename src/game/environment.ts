import {getMap} from '../../shared/maps';
import type {EnvironmentQuality,MapDefinition,MapId} from '../../shared/maps';
import {terrainTemplate,WORLD} from '../../shared/physics';

/** W×H is the view; a map's world may be wider (`dimensions.width`) and the camera scrolls across it. */
const W=WORLD.width,H=WORLD.height,TERRAIN_SCALE=2,MID_OFFSET=60,SOFT_EDGE_GAIN=3;
/** The painted rim cut around a hole (6 px) and the cells it spans on the terrain grid. */
const RIM_PX=6,RIM_CELLS=Math.round(RIM_PX/WORLD.cell);
/** Art direction: dim only the distant/parallax painting, never the playfield. */
export const PARALLAX_SHADE_ALPHA=.14;
const images=new Map<string,HTMLImageElement>();
const decodedImages=new WeakMap<HTMLImageElement,Promise<boolean>>();
function loadImage(src:string){let image=images.get(src);if(!image){image=new Image();image.decoding='async';image.src=src;images.set(src,image);decodedImages.set(image,image.decode().then(()=>true,()=>false));}return image;}
const preloadedMaps=new Map<string,Promise<boolean>>();
/** Decode before entering a map; callers may prefetch while its room is open. */
export function preloadEnvironment(map:MapId):Promise<boolean>{
 // Keyed by terrain art: a map republished in the admin panel loads its new art.
 const def=getMap(map),cached=preloadedMaps.get(def.art.terrain);if(cached)return cached;
 const sources=[def.art.background,...def.art.mid?[def.art.mid]:[],def.art.terrain];
 const ready=Promise.all([...new Set(sources)].map(src=>decodedImages.get(loadImage(src))!)).then(results=>results.every(Boolean));preloadedMaps.set(def.art.terrain,ready);return ready;
}
/**
 * Forgets the map paintings decoded for a finished battle, except `keep`'s (the map of the room the
 * players return to), so the next match does not carry the previous one's art in memory.
 */
export function releaseEnvironment(keep?:MapId){
 const kept=new Set<string>();
 if(keep){const def=getMap(keep);for(const src of [def.art.background,def.art.mid,def.art.terrain,`/assets/maps/${def.id}-preview.png`])if(src)kept.add(src);}
 for(const src of [...images.keys()])if(!kept.has(src))images.delete(src);
 for(const key of [...preloadedMaps.keys()])if(!kept.has(key))preloadedMaps.delete(key);
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

/** World px the battle console covers at the bottom of the view: the camera may look this far below the map,
 * so a fighter standing at the very bottom edge still shows above the console. */
export const BATTLE_HUD_COVER=120;
export interface CameraState {x:number;y:number;zoom:number;targetZoom:number;targetX:number;targetY:number;worldWidth:number;}
export function createCamera(worldWidth=W):CameraState{return {x:W/2,y:H/2,zoom:1,targetZoom:1,targetX:W/2,targetY:H/2,worldWidth};}
export function zoomCamera(camera:CameraState,delta:number,map:MapDefinition){camera.targetZoom=Math.max(map.camera.minZoom,Math.min(map.camera.maxZoom,camera.targetZoom+delta));}
export function updateCamera(camera:CameraState,x:number,y:number){
 camera.zoom+=(camera.targetZoom-camera.zoom)*.09;
 const hw=W/(2*camera.zoom),hh=H/(2*camera.zoom);
 const right=camera.worldWidth??W;camera.targetX=Math.max(hw,Math.min(right-hw,x));camera.targetY=Math.max(hh,Math.min(H-hh+BATTLE_HUD_COVER,y));
 camera.x+=(camera.targetX-camera.x)*.075;camera.y+=(camera.targetY-camera.y)*.075;
 camera.x=Math.max(hw,Math.min(right-hw,camera.x));camera.y=Math.max(hh,Math.min(H-hh+BATTLE_HUD_COVER,camera.y));
}
export function applyCamera(c:CanvasRenderingContext2D,camera:CameraState,depth=1){
 const zoom=1+(camera.zoom-1)*Math.min(1,depth);
 c.translate(W/2,H/2);c.scale(zoom,zoom);c.translate(-W/2-(camera.x-W/2)*depth,-H/2-(camera.y-H/2)*depth);
}

/** Terrain cells → a smooth shape at the terrain buffer's scale, only over the damaged box (in cells). Thresholding the
 * bilinear upscale at half coverage turns cell stairs into diagonals (marching squares); a short ramp keeps ~1px of antialiasing. */
function softCells(cells:HTMLCanvasElement,box:{width:number;height:number}):HTMLCanvasElement {
 const k=WORLD.cell*TERRAIN_SCALE,out=makeCanvas(box.width*k,box.height*k),o=out.getContext('2d',{willReadFrequently:true})!;
 smoothImages(o);o.drawImage(cells,0,0,box.width,box.height,0,0,out.width,out.height);
 const image=o.getImageData(0,0,out.width,out.height),d=image.data;
 for(let i=3;i<d.length;i+=4){const a=d[i];if(a&&a<255)d[i]=Math.max(0,Math.min(255,Math.round((a-128)*SOFT_EDGE_GAIN+128)));}
 o.putImageData(image,0,0);return out;
}
/** Cells around a change whose pixels can move: rim cut, the smoothing footprint and the shade/lip shadows. */
const INFLUENCE_CELLS=Math.round((RIM_PX+15)/WORLD.cell);
interface CellBox {x:number;y:number;width:number;height:number;}
/** The painted terrain with its own antialiased silhouette; only the cells the authoritative
 * simulation has dug out are cut away (collision was traced from this very painting by `npm run build:map`).
 * Masking the untouched outline by 3px cells too would chop its thin painted rim into stairs.
 * With `into` and `region` (in cells) only that part of an already painted canvas is redone, from the
 * same inputs, so one crater costs its own size instead of a repaint of the whole map. */
export function paintTerrain(data:Uint8Array,map:MapId,worldArt:CanvasImageSource,into?:HTMLCanvasElement,region?:CellBox):HTMLCanvasElement {
 const def=getMap(map),W=def.dimensions.width,COLS=W/WORLD.cell,template=terrainTemplate(map),k=WORLD.cell*TERRAIN_SCALE;
 const canvas=into??makeCanvas(W*TERRAIN_SCALE,H*TERRAIN_SCALE),c=canvas.getContext('2d')!;
 const area=region??{x:0,y:0,width:COLS,height:WORLD.rows};
 // Cells that can change a pixel of `area`: the cut and shading are rebuilt from all of them.
 const reach=region?{x:Math.max(0,area.x-INFLUENCE_CELLS),y:Math.max(0,area.y-INFLUENCE_CELLS),right:Math.min(COLS,area.x+area.width+INFLUENCE_CELLS),bottom:Math.min(WORLD.rows,area.y+area.height+INFLUENCE_CELLS)}:{x:0,y:0,right:COLS,bottom:WORLD.rows};
 c.save();
 if(region){c.beginPath();c.rect(area.x*k,area.y*k,area.width*k,area.height*k);c.clip();c.clearRect(area.x*k,area.y*k,area.width*k,area.height*k);}
 c.scale(TERRAIN_SCALE,TERRAIN_SCALE);smoothImages(c);c.drawImage(worldArt,0,0,W,H);
 let damaged=false,minX=COLS,minY=WORLD.rows,maxX=-1,maxY=-1;
 for(let y=reach.y;y<reach.bottom;y++)for(let x=reach.x,i=y*COLS+x;x<reach.right;x++,i++)if(template.solid[i]&&!data[i]){damaged=true;if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}
 if(damaged){
  // Pad past the rim cells and the bilinear footprint so the box edge never shows. Both masks cover only this box.
  const pad=RIM_CELLS+2,box={x:Math.max(0,minX-pad),y:Math.max(0,minY-pad),width:0,height:0};box.width=Math.min(COLS,maxX+pad+1)-box.x;box.height=Math.min(WORLD.rows,maxY+pad+1)-box.y;
  const fracture=makeCanvas(box.width,box.height),fc=fracture.getContext('2d')!,edge=fc.createImageData(box.width,box.height);
  // The painted rim lies in the soft, non-colliding cells just outside the collision; cut it with the dug cells so no sliver floats over a crater.
  const cut=makeCanvas(box.width,box.height),cc=cut.getContext('2d')!,cutCells=cc.createImageData(box.width,box.height);
  for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){const i=y*COLS+x;if(!template.solid[i]||data[i])continue;const local=(y-box.y)*box.width+x-box.x;edge.data[local*4+3]=255;cutCells.data[local*4+3]=255;
   for(let dy=-RIM_CELLS;dy<=RIM_CELLS;dy++)for(let dx=-RIM_CELLS;dx<=RIM_CELLS;dx++){const nx=x+dx,ny=y+dy;if(nx>=box.x&&ny>=box.y&&nx<box.x+box.width&&ny<box.y+box.height&&!template.solid[ny*COLS+nx])cutCells.data[((ny-box.y)*box.width+nx-box.x)*4+3]=255;}}
  fc.putImageData(edge,0,0);cc.putImageData(cutCells,0,0);
  const left=box.x*k,top=box.y*k,hole=softCells(cut,box),dug=softCells(fracture,box);
  c.setTransform(1,0,0,1,0,0);c.globalCompositeOperation='destination-out';c.drawImage(hole,left,top);c.globalCompositeOperation='source-atop';
  // Generic broken edge, the same for every weapon: a short cool shade inside the cut and a thin
  // light lip on the crater floor, never a burnt halo. Only the shadows land: the shape itself is drawn off-canvas.
  const away=canvas.width;c.shadowOffsetX=away;
  c.shadowColor='rgba(14,18,34,.62)';c.shadowBlur=4*TERRAIN_SCALE;c.drawImage(dug,left-away,top);
  c.shadowColor='rgba(255,255,255,.7)';c.shadowBlur=1.2*TERRAIN_SCALE;c.shadowOffsetY=1.6*TERRAIN_SCALE;c.drawImage(dug,left-away,top);
 }
 c.restore();
 return canvas;
}
/** The cells whose dug state differs between two terrains, or null when none does. */
function changedCells(before:Uint8Array,after:Uint8Array,cols:number):CellBox|null{
 if(before.length!==after.length)return null;
 let minX=cols,minY=WORLD.rows,maxX=-1,maxY=-1;
 for(let i=0;i<after.length;i++)if(!before[i]!==!after[i]){const x=i%cols,y=(i-x)/cols;if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}
 return maxX<0?null:{x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1};
}

export class EnvironmentRenderer {
 readonly definition:MapDefinition;readonly width:number;private data:Uint8Array;/** The terrain the canvases show, to repaint only what a new snapshot changed. */private painted:Uint8Array|null=null;private terrain:HTMLCanvasElement;private terrainDrawing:HTMLCanvasElement;
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
  const before=this.painted;this.data=data;if(!this.isReady())return;
  const cols=this.width/WORLD.cell,changed=before?changedCells(before,data,cols):null;
  this.painted=data.slice();
  if(before&&!changed)return;
  // A crater repaints only the cells it can affect; the first paint (or a huge change) does the whole map.
  const region=changed&&changed.width*changed.height<cols*WORLD.rows/3?{x:Math.max(0,changed.x-INFLUENCE_CELLS),y:Math.max(0,changed.y-INFLUENCE_CELLS),width:0,height:0}:null;
  if(region&&changed){region.width=Math.min(cols,changed.x+changed.width+INFLUENCE_CELLS)-region.x;region.height=Math.min(WORLD.rows,changed.y+changed.height+INFLUENCE_CELLS)-region.y;}
  this.terrain=region?paintTerrain(data,this.definition.id,this.worldArt,this.terrain,region):paintTerrain(data,this.definition.id,this.worldArt);
  // Resolve supersampled coverage once at the artwork's native world resolution.
  // Re-filtering the full 2x surface on every pan is expensive in software Canvas.
  if(!region){this.terrainDrawing=makeCanvas(this.width,H);const resolved=this.terrainDrawing.getContext('2d')!;smoothImages(resolved);resolved.drawImage(this.terrain,0,0,this.width,H);return;}
  const resolved=this.terrainDrawing.getContext('2d')!,x=region.x*WORLD.cell,y=region.y*WORLD.cell,w=region.width*WORLD.cell,h=region.height*WORLD.cell,pad=4;
  // Filter from a slightly larger source than the cleared box, so its edge matches the untouched pixels around it.
  const sx=Math.max(0,x-pad),sy=Math.max(0,y-pad),sw=Math.min(this.width,x+w+pad)-sx,sh=Math.min(H,y+h+pad)-sy;
  resolved.save();resolved.beginPath();resolved.rect(x,y,w,h);resolved.clip();resolved.clearRect(x,y,w,h);smoothImages(resolved);
  resolved.drawImage(this.terrain,sx*TERRAIN_SCALE,sy*TERRAIN_SCALE,sw*TERRAIN_SCALE,sh*TERRAIN_SCALE,sx,sy,sw,sh);resolved.restore();
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
  // Under the painting, its last rows stretched down: the camera can look BATTLE_HUD_COVER below the map.
  const layer=this.cached(key,width,H+margin*2+BATTLE_HUD_COVER,ctx=>{const scale=Math.max(fit,width/image.naturalWidth),height=image.naturalHeight*scale,left=(width-image.naturalWidth*scale)/2;smoothImages(ctx);ctx.drawImage(image,left,H+margin*2-height,image.naturalWidth*scale,height);if(key==='backdrop')ctx.drawImage(image,0,image.naturalHeight-2,image.naturalWidth,2,left,H+margin*2-1,image.naturalWidth*scale,BATTLE_HUD_COVER+1);});
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
