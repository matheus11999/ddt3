import {getMap,MATERIALS} from '../../shared/maps';
import type {EnvironmentObject,EnvironmentQuality,MapDefinition,MapId,Shape} from '../../shared/maps';
import {ground,solid,terrainTemplate,WORLD} from '../../shared/physics';

const W=WORLD.width,H=WORLD.height,TAU=Math.PI*2;
const images=new Map<string,HTMLImageElement>();
function loadImage(src:string){let image=images.get(src);if(!image){image=new Image();image.decoding='async';image.src=src;images.set(src,image);}return image;}
let quality:EnvironmentQuality='high';
try{const value=localStorage.getItem('brasa-environment-quality');if(value==='low'||value==='medium'||value==='high')quality=value;}catch{}
export function getEnvironmentQuality(){return quality;}
export function setEnvironmentQuality(value:EnvironmentQuality){quality=value;try{localStorage.setItem('brasa-environment-quality',value);}catch{}}
const count=(low:number,medium:number,high:number)=>quality==='low'?low:quality==='medium'?medium:high;
function random(seed:number){return ((Math.sin(seed*127.1+311.7)*43758.5453)%1+1)%1;}
function hex(color:string){return [parseInt(color.slice(1,3),16),parseInt(color.slice(3,5),16),parseInt(color.slice(5,7),16)];}
function gradient(c:CanvasRenderingContext2D,y:number,height:number,a:string,b:string){const g=c.createLinearGradient(0,y,0,y+height);g.addColorStop(0,a);g.addColorStop(1,b);return g;}
function ellipse(c:CanvasRenderingContext2D,x:number,y:number,rx:number,ry:number,color:string){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fill();}
function shapePath(c:CanvasRenderingContext2D,shape:Shape){c.beginPath();if(shape.kind==='rect')c.rect(shape.x,shape.y,shape.width,shape.height);else if(shape.kind==='ellipse')c.ellipse(shape.x,shape.y,shape.rx,shape.ry,0,0,TAU);else{shape.points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();}}
export interface CameraState {x:number;y:number;zoom:number;targetZoom:number;targetX:number;targetY:number;}
export function createCamera():CameraState{return {x:W/2,y:H/2,zoom:1,targetZoom:1,targetX:W/2,targetY:H/2};}
export function zoomCamera(camera:CameraState,delta:number,map:MapDefinition){camera.targetZoom=Math.max(map.camera.minZoom,Math.min(map.camera.maxZoom,camera.targetZoom+delta));}
export function updateCamera(camera:CameraState,x:number,y:number){
 camera.zoom+=(camera.targetZoom-camera.zoom)*.09;
 const hw=W/(2*camera.zoom),hh=H/(2*camera.zoom);
 camera.targetX=Math.max(hw,Math.min(W-hw,x));camera.targetY=Math.max(hh,Math.min(H-hh,y));
 camera.x+=(camera.targetX-camera.x)*.075;camera.y+=(camera.targetY-camera.y)*.075;
 camera.x=Math.max(hw,Math.min(W-hw,camera.x));camera.y=Math.max(hh,Math.min(H-hh,camera.y));
}
export function applyCamera(c:CanvasRenderingContext2D,camera:CameraState,depth=1){
 const zoom=1+(camera.zoom-1)*Math.min(1,depth);
 c.translate(W/2,H/2);c.scale(zoom,zoom);c.translate(-W/2-(camera.x-W/2)*depth,-H/2-(camera.y-H/2)*depth);
}

/** Terrain artwork is masked by exactly the same cells the authoritative simulation uses. */
export function paintTerrain(data:Uint8Array,map:MapId,texture?:CanvasImageSource):HTMLCanvasElement {
 const def=getMap(map),template=terrainTemplate(map),small=document.createElement('canvas');small.width=WORLD.cols;small.height=WORLD.rows;
 const s=small.getContext('2d')!,pixels=s.createImageData(WORLD.cols,WORLD.rows);
 for(let i=0;i<data.length;i++){if(!data[i])continue;const region=template.definition[template.regions[i]];if(!region)continue;const color=hex(MATERIALS[region.material].color),x=i%WORLD.cols,y=Math.floor(i/WORLD.cols),noise=(random(x+y*19)-.5)*13;const edge=y===0||!data[i-WORLD.cols];
  for(let n=0;n<3;n++)pixels.data[i*4+n]=color[n]+noise+(edge?25:0);pixels.data[i*4+3]=255;
 }s.putImageData(pixels,0,0);
 const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const c=canvas.getContext('2d')!;c.imageSmoothingEnabled=true;c.drawImage(small,0,0,W,H);
 c.save();c.globalCompositeOperation='source-atop';
 if(texture){c.globalAlpha=.94;c.drawImage(texture,0,470,W,415);c.globalAlpha=1;}
 else{c.fillStyle=gradient(c,530,300,'#f4d0a22d','#2b23414f');c.fillRect(0,450,W,H);}
 // Every material keeps its own hue and texture; masonry stays distinct in hybrid maps.
 for(const region of def.regions){
  if(region.surface==='wood')continue;c.save();shapePath(c,region.shape);c.clip();
  if(region.material==='sand'){c.fillStyle='#efd19a55';c.fillRect(0,0,W,H);}else if(region.material==='magic'){c.fillStyle='#8f90e84a';c.fillRect(0,0,W,H);}
  if(region.surface==='paving'||region.surface==='marble'){
   c.fillStyle=gradient(c,530,260,region.material==='metal'?'#8a91a4':'#f5e8d0',region.material==='metal'?'#464858':'#9b94b4');c.fillRect(0,0,W,H);
   if(texture&&def.id==='celestial'){c.globalAlpha=.85;c.drawImage(texture,0,510,W,350);c.globalAlpha=1;}
   c.lineWidth=1.5;c.strokeStyle='#514f6b64';for(let row=0;row<11;row++){const yy=546+row*23;c.beginPath();c.moveTo(0,yy);c.lineTo(W,yy);c.stroke();for(let xx=(row%2)*42;xx<W;xx+=84){c.beginPath();c.moveTo(xx,yy);c.lineTo(xx,yy+23);c.stroke();}}
   c.strokeStyle='#fff0ca6b';c.lineWidth=2;shapePath(c,region.shape);c.stroke();
  }c.restore();
 }
 // Roots, pebbles and mineral veins are clipped to remaining soil, including crater edges.
 c.lineCap='round';for(let n=0;n<95;n++){const x=random(n+10)*W,y=610+random(n+400)*210;
  if(def.id!=='celestial'){c.strokeStyle=n%2?'#7451324d':'#efc19045';c.lineWidth=2+random(n)*4;c.beginPath();c.moveTo(x,y);c.bezierCurveTo(x-15,y+8,x+8,y+21,x-13,y+35);c.stroke();}
 }
 c.restore();
 // An irregular illustrated rim follows ALL exposed upward faces, rather than a fixed band.
 for(let x=0;x<WORLD.cols;x++)for(let y=1;y<WORLD.rows;y++){
  const i=y*WORLD.cols+x;if(!data[i]||data[i-WORLD.cols])continue;const region=template.definition[template.regions[i]];if(!region||region.surface==='wood')continue;
  const px=x*3,py=y*3,isOriginal=template.solid[i-WORLD.cols]===0;
  c.lineWidth=3;c.strokeStyle=isOriginal&&region.surface==='grass'?'#416f40':isOriginal?'#f8edcc':'#593e45';c.beginPath();c.moveTo(px,py+1);c.lineTo(px+3,py+1);c.stroke();
  if(isOriginal&&region.surface==='grass'&&x%2===0){const h=4+random(x)*8;c.strokeStyle=x%3?'#7ba85a':'#b9ce76';c.lineWidth=1.7;c.beginPath();c.moveTo(px,py+1);c.quadraticCurveTo(px-2,py-h*.6,px-4+random(x+1)*7,py-h);c.stroke();
   if(x%17===0){const col=['#f8d4d9','#efe6ac','#cfbce9'][x%3];for(let p=0;p<5;p++)ellipse(c,px+Math.cos(p*TAU/5)*3,py-8+Math.sin(p*TAU/5)*3,2.5,2.2,col);ellipse(c,px,py-8,1.7,1.7,'#e7ad5c');}
  }
 }
 return canvas;
}

export class EnvironmentRenderer {
 readonly definition:MapDefinition;private data:Uint8Array;private terrain:HTMLCanvasElement;private art:HTMLImageElement;private texture:HTMLImageElement;private textured=false;private objectLayers=new Map<string,HTMLCanvasElement>();
 constructor(map:MapId,data:Uint8Array){this.definition=getMap(map);this.data=data;this.art=loadImage(this.definition.art.midground);this.texture=loadImage(`/assets/maps/${this.definition.id}-terrain.png`);this.terrain=paintTerrain(data,map);}
 setTerrain(data:Uint8Array){this.data=data;this.terrain=paintTerrain(data,this.definition.id,this.texture.complete&&this.texture.naturalWidth?this.texture:undefined);this.objectLayers.clear();}
 getTerrainLayer(){return this.terrain;}
 drawBack(c:CanvasRenderingContext2D,time:number,camera:CameraState){
  const m=this.definition;c.fillStyle=gradient(c,0,H,m.lighting.sky,m.lighting.horizon);c.fillRect(0,0,W,H);
  c.save();applyCamera(c,camera,.08);
  const sun=c.createRadialGradient(1120,130,10,1120,130,235);sun.addColorStop(0,m.id==='park'?'#fff2ddc0':'#fffcebbb');sun.addColorStop(.2,'#fff6e665');sun.addColorStop(1,'#fff6e600');c.fillStyle=sun;c.fillRect(830,-120,580,500);
  for(let i=0;i<count(5,8,11);i++){const x=((i*227+time*(.003+i%3*.001))%(W+300))-150,y=75+i%4*62;cloud(c,x,y,65+i%4*18,m.id==='park'?'#f8dee876':'#ffffff8c');}c.restore();
  c.save();applyCamera(c,camera,.22);
  if(m.id==='celestial'){
   for(let i=0;i<5;i++){const x=110+i*337,y=320+Math.sin(i*3)*80;floatingIsland(c,x,y,.25+i%2*.1);}
  }else{
   for(let layer=0;layer<3;layer++){c.fillStyle=[m.id==='garden'?'#a8ceaf':'#b5a6c5',m.id==='garden'?'#83bca0':'#ae91b6',m.id==='garden'?'#6ca98c':'#9c86a9'][layer];c.beginPath();c.moveTo(-300,620);for(let x=-300;x<=W+300;x+=20)c.lineTo(x,350+layer*65+Math.sin(x/220+layer*2)*40+Math.sin(x/103)*12);c.lineTo(W+300,H);c.lineTo(-300,H);c.fill();}
  }c.restore();
  c.save();applyCamera(c,camera,.55);
  if(this.art.complete&&this.art.naturalWidth){c.save();c.globalAlpha=m.id==='celestial'?.88:.98;const y=m.id==='celestial'?-10:18,height=m.id==='celestial'?605:555;c.drawImage(this.art,-42,y,W+84,height);c.restore();}
  for(const object of m.objects)if(object.layer===3)this.drawObject(c,object,time);
  c.restore();
 }
 drawTerrain(c:CanvasRenderingContext2D,time:number){
  if(!this.textured&&this.texture.complete&&this.texture.naturalWidth){this.textured=true;this.setTerrain(this.data);}
  c.drawImage(this.terrain,0,0);
  for(const object of this.definition.objects)if(object.layer===5)this.drawObject(c,object,time);
 }
 drawFront(c:CanvasRenderingContext2D,time:number,camera:CameraState){
  c.save();applyCamera(c,camera,1.12);
  for(const object of this.definition.objects)if(object.layer===6)this.drawObject(c,object,time);
  if(this.definition.id==='celestial')for(let i=0;i<count(3,5,7);i++)cloud(c,-100+((i*291+time*.012)%(W+200)),827+i%3*15,155,'#dfe9ff7a');
  c.restore();c.save();applyCamera(c,camera,.85);this.atmosphere(c,time);c.restore();
 }
 private drawObject(c:CanvasRenderingContext2D,o:EnvironmentObject,time:number){
  // Solid scenery artwork is clipped by the authoritative material mask; damaged crates never remain as invisible blockers.
  if(o.region){let layer=this.objectLayers.get(o.id);if(!layer){layer=document.createElement('canvas');layer.width=W;layer.height=H;const ctx=layer.getContext('2d')!;this.object(ctx,o,0);const mask=document.createElement('canvas');mask.width=WORLD.cols;mask.height=WORLD.rows;const mc=mask.getContext('2d')!,im=mc.createImageData(WORLD.cols,WORLD.rows),template=terrainTemplate(this.definition.id),region=template.definition.findIndex(r=>r.id===o.region);for(let i=0;i<this.data.length;i++)if(this.data[i]&&template.regions[i]===region)im.data[i*4+3]=255;mc.putImageData(im,0,0);ctx.globalCompositeOperation='destination-in';ctx.drawImage(mask,0,0,W,H);this.objectLayers.set(o.id,layer);}c.drawImage(layer,0,0);
   if(o.kind==='crystal'&&solid(this.data,o.x,o.y-16)&&quality!=='low'){c.save();c.globalAlpha=.2+Math.sin(time/700)*.08;ellipse(c,o.x,o.y-32,15,35,'#b4e9ff');c.restore();}return;
  }
  this.object(c,o,time);
 }
 private object(c:CanvasRenderingContext2D,o:EnvironmentObject,time:number){
  c.save();c.translate(o.x,o.y);c.scale(o.scale,o.scale);const t=time/1000;
  if(o.kind==='ferris')ferris(c,t);
  else if(o.kind==='carousel')carousel(c,t);
  else if(o.kind==='fountain')fountain(c,t);
  else if(o.kind==='flag')flag(c,t);
  else if(o.kind==='balloons')balloons(c,t);
  else if(o.kind==='bunting')bunting(c,t);
  else if(o.kind==='statue')statue(c);
  else if(o.kind==='crystal')crystal(c,t);
  else if(o.kind==='crate'||o.kind==='barrel')container(c,o.kind);
  else if(o.kind==='flowers')flowers(c,t);
  else if(o.kind==='fence')fence(c);
  // The generated canopy carries fine leaf detail; a handful of animated leaves gives it motion.
  else if(o.kind==='tree'){for(let i=0;i<count(4,8,13);i++){c.save();c.translate(Math.sin(i*2.1)*75,-100+Math.cos(i*1.3)*55);c.rotate(Math.sin(t*.8+i)*.12+i);ellipse(c,0,0,10,3.6,this.definition.id==='garden'?'#b4d69191':'#a2d3b691');c.restore();}}
  c.restore();
 }
 private atmosphere(c:CanvasRenderingContext2D,time:number){
  const m=this.definition,n=count(12,28,48),t=time/1000;
  for(let i=0;i<n;i++){
   const x=(random(i+80)*W+t*(m.id==='park'?5:9+i%4))%W,y=80+((random(i+190)*590+t*(m.id==='garden'?7:3))%590);c.save();c.translate(x,y);c.rotate(t*.7+i);c.globalAlpha=.3+Math.sin(t+i)*.16;
   if(m.id==='garden'){ellipse(c,0,0,3+i%3,1.5+i%2,i%3?'#f7c7df':'#fff0bc');}
   else if(m.id==='park'){c.fillStyle=['#ffe49a','#e9b5dd','#aee8df'][i%3];c.fillRect(-2,-2,3+i%3,5);}
   else{c.strokeStyle=i%3?'#d2eeff':'#f8eac4';c.lineWidth=1;c.beginPath();c.moveTo(-3,0);c.lineTo(3,0);c.moveTo(0,-3);c.lineTo(0,3);c.stroke();}c.restore();
  }
  if(m.id==='garden')for(let i=0;i<count(1,3,5);i++){const x=250+i*246+Math.sin(t*.5+i)*52,y=360+Math.sin(t*.8+i*2)*42;c.save();c.translate(x,y);const wing=Math.abs(Math.sin(t*9+i))*6+1;ellipse(c,-wing/2,-2,wing,4,i%2?'#dfb0f0':'#f4d58e');ellipse(c,wing/2,-2,wing,4,i%2?'#dfb0f0':'#f4d58e');c.fillStyle='#7d6580';c.fillRect(-1,-3,2,7);c.restore();}
 }
}

function cloud(c:CanvasRenderingContext2D,x:number,y:number,size:number,color:string){c.save();c.globalAlpha=.75;for(let i=0;i<5;i++)ellipse(c,x+(i-2)*size*.38,y+Math.sin(i*2)*size*.08,size*(.45+i%2*.12),size*(.16+i%3*.06),color);c.restore();}
function floatingIsland(c:CanvasRenderingContext2D,x:number,y:number,s:number){c.save();c.translate(x,y);c.scale(s,s);c.fillStyle='#a3aac8';c.beginPath();c.moveTo(-140,0);c.lineTo(140,0);c.lineTo(70,90);c.lineTo(-5,160);c.lineTo(-80,80);c.closePath();c.fill();ellipse(c,0,0,145,23,'#d5d8e6');for(let i=0;i<3;i++){c.fillStyle='#ccd6e5';c.fillRect(-72+i*60,-100-i%2*45,35,100+i%2*45);c.fillStyle='#7d9ec1';c.beginPath();c.moveTo(-79+i*60,-100-i%2*45);c.lineTo(-54+i*60,-144-i%2*45);c.lineTo(-30+i*60,-100-i%2*45);c.fill();}c.restore();}
function ferris(c:CanvasRenderingContext2D,t:number){
 const r=123;c.strokeStyle='#65567a';c.lineWidth=12;c.beginPath();c.moveTo(-65,180);c.lineTo(0,0);c.lineTo(65,180);c.stroke();c.strokeStyle='#e3be9b';c.lineWidth=5;c.stroke();
 c.save();c.rotate(t*.055);c.strokeStyle='#826788';c.lineWidth=11;c.beginPath();c.arc(0,0,r,0,TAU);c.stroke();c.strokeStyle='#eccaa8';c.lineWidth=5;c.stroke();
 for(let i=0;i<12;i++){const a=i*TAU/12;c.strokeStyle='#d1a2a6';c.lineWidth=3;c.beginPath();c.moveTo(0,0);c.lineTo(Math.cos(a)*r,Math.sin(a)*r);c.stroke();for(let j=0;j<3;j++){const b=a+j*TAU/36;ellipse(c,Math.cos(b)*r,Math.sin(b)*r,2.6,2.6,Math.sin(t*2+i+j)>.25?'#fff1bc':'#daac7a');}
  c.save();c.translate(Math.cos(a)*r,Math.sin(a)*r);c.rotate(-t*.055);c.strokeStyle='#b89280';c.lineWidth=2;c.beginPath();c.moveTo(-10,8);c.lineTo(-6,-2);c.lineTo(6,-2);c.lineTo(10,8);c.stroke();c.fillStyle=['#c56f84','#6eaaae','#bc9bc5'][i%3];c.beginPath();c.roundRect(-15,8,30,23,[3,3,8,8]);c.fill();c.strokeStyle='#eed5a3';c.stroke();c.fillStyle='#fff0d4';c.fillRect(-10,11,20,5);c.restore();
 }c.restore();ellipse(c,0,0,14,14,'#f0cf94');ellipse(c,0,0,7,7,'#a97993');
}
function carousel(c:CanvasRenderingContext2D,t:number){
 ellipse(c,0,0,108,16,'#847394');ellipse(c,0,-7,105,13,'#e4c39d');c.fillStyle='#c5a17f';c.fillRect(-8,-130,16,119);
 for(let i=0;i<7;i++){const a=i*TAU/7+t*.3,x=Math.cos(a)*75,depth=(Math.sin(a)+1)/2;c.save();c.globalAlpha=.65+depth*.35;c.strokeStyle='#e8c99b';c.lineWidth=3;c.beginPath();c.moveTo(x,-112);c.lineTo(x,-20);c.stroke();const y=-43+Math.sin(t*1.8+i)*6;ellipse(c,x,y,14,7,['#f7e8d3','#d9bbcd','#b5d4cf'][i%3]);c.beginPath();c.fillStyle='#f1e4cd';c.moveTo(x+7,y-2);c.lineTo(x+12,y-18);c.lineTo(x+20,y-16);c.lineTo(x+17,y-10);c.lineTo(x+14,y+5);c.fill();c.strokeStyle='#c39c80';c.lineWidth=3;c.beginPath();c.moveTo(x-8,y+5);c.lineTo(x-14,y+12);c.moveTo(x+7,y+4);c.lineTo(x+13,y+11);c.stroke();c.restore();}
 for(let i=0;i<10;i++){c.fillStyle=i%2?'#d79aa4':'#f6dfb6';c.beginPath();c.moveTo(0,-170);c.quadraticCurveTo(-100+i*22,-125,-112+i*22.4,-112);c.lineTo(-90+i*22.4,-112);c.quadraticCurveTo(-90+i*22,-125,0,-170);c.fill();}c.strokeStyle='#a37b72';c.lineWidth=3;c.beginPath();c.moveTo(-112,-112);c.quadraticCurveTo(0,-96,112,-112);c.stroke();for(let i=0;i<13;i++)ellipse(c,-104+i*17.4,-109+Math.sin(i*Math.PI/12)*5,3,3,'#ffe8ac');ellipse(c,0,-172,6,6,'#dcb56d');
}
function fountain(c:CanvasRenderingContext2D,t:number){
 // Fine moving arcs are layered over the illustrated basin.
 c.save();c.translate(-9,-36);c.globalAlpha=.55;c.strokeStyle='#d9f9ff';c.lineWidth=1.8;
 for(let n=0;n<7;n++){const d=(n-3)*15;c.beginPath();c.moveTo(0,-61);c.quadraticCurveTo(d,-83,d*1.7,0);c.stroke();for(let j=0;j<3;j++){const a=(t*.48+j/3+n*.07)%1,x=2*(1-a)*a*d+a*a*d*1.7,y=(1-a)**2*-61+2*(1-a)*a*-83;ellipse(c,x,y,1.5,2,'#edfdff');}}
 for(let i=0;i<3;i++){const a=(t*.4+i/3)%1;c.globalAlpha=(1-a)*.4;c.beginPath();c.ellipse(0,1,12+a*54,3+a*10,0,0,TAU);c.stroke();}c.restore();
}
function flag(c:CanvasRenderingContext2D,t:number){c.strokeStyle='#c1ad87';c.lineWidth=5;c.beginPath();c.moveTo(0,0);c.lineTo(0,-148);c.stroke();ellipse(c,0,-150,5,5,'#f6dea5');c.fillStyle=gradient(c,-144,75,'#a4b8e0','#6c7eae');c.beginPath();c.moveTo(3,-142);c.bezierCurveTo(30,-148+Math.sin(t*2)*5,42,-124,68,-137+Math.sin(t*2+1)*7);c.lineTo(58,-100+Math.sin(t*2+1)*5);c.bezierCurveTo(35,-91,23,-114,3,-106);c.closePath();c.fill();c.strokeStyle='#e9d6a0';c.lineWidth=2;c.stroke();c.fillStyle='#f0d9a6';c.beginPath();c.moveTo(28,-128);c.lineTo(34,-116);c.lineTo(28,-110);c.lineTo(22,-119);c.fill();}
function balloons(c:CanvasRenderingContext2D,t:number){for(let i=0;i<5;i++){const x=Math.sin(i*2)*19+Math.sin(t+i)*3,y=-70-i%3*19+Math.cos(t+i)*4;c.strokeStyle='#8d7c9d';c.lineWidth=1;c.beginPath();c.moveTo(0,20);c.quadraticCurveTo(x+10,-20,x,y+18);c.stroke();const g=c.createRadialGradient(x-5,y-7,0,x,y,24);g.addColorStop(0,['#f6c7cd','#d2e5dc','#e2d4f0','#ffe6a0','#bdd9e4'][i]);g.addColorStop(1,['#be788c','#73aba3','#b58cbc','#d4ab5a','#7aaabe'][i]);ellipse(c,x,y,15,20,g as unknown as string);ellipse(c,x-5,y-8,3,6,'#fff8e77a');}}
function bunting(c:CanvasRenderingContext2D,t:number){c.strokeStyle='#9c7b83';c.lineWidth=2;c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(230,52,460,0);c.stroke();for(let i=0;i<16;i++){const x=i*29+10,y=26*Math.sin(x/460*Math.PI);c.fillStyle=['#d799a7','#e8d59c','#87bbb4'][i%3];c.beginPath();c.moveTo(x,y);c.lineTo(x+24,y+2);c.lineTo(x+11+Math.sin(t*2+i)*3,y+24);c.closePath();c.fill();}}
function crystal(c:CanvasRenderingContext2D,t:number){c.save();c.shadowColor='#8fcdf4';c.shadowBlur=quality==='high'?12+Math.sin(t)*3:0;for(let i=0;i<3;i++){const x=(i-1)*17,h=i===1?88:51;c.fillStyle=['#92add8','#b8daf1','#8c92c8'][i];c.beginPath();c.moveTo(x-12,-h*.6);c.lineTo(x,-h);c.lineTo(x+12,-h*.6);c.lineTo(x+9,-5);c.lineTo(x-7,0);c.closePath();c.fill();c.fillStyle='#e0f7ffa1';c.beginPath();c.moveTo(x,-h);c.lineTo(x,-8);c.lineTo(x-7,0);c.lineTo(x-12,-h*.6);c.closePath();c.fill();}c.restore();}
function statue(c:CanvasRenderingContext2D){c.fillStyle=gradient(c,-120,120,'#f3ead6','#a9a3b9');c.beginPath();c.roundRect(-29,-15,58,15,4);c.fill();c.fillRect(-19,-28,38,13);c.beginPath();c.moveTo(-16,-30);c.lineTo(-12,-81);c.lineTo(-26,-62);c.lineTo(-38,-73);c.lineTo(-20,-93);c.quadraticCurveTo(0,-104,20,-93);c.lineTo(38,-73);c.lineTo(26,-62);c.lineTo(12,-81);c.lineTo(16,-30);c.closePath();c.fill();ellipse(c,0,-114,14,19,'#e7dfd3');c.strokeStyle='#b7aec1';c.lineWidth=3;c.beginPath();c.moveTo(-8,-72);c.lineTo(-7,-32);c.moveTo(7,-72);c.lineTo(8,-32);c.stroke();}
function container(c:CanvasRenderingContext2D,kind:'crate'|'barrel'){c.fillStyle=gradient(c,-54,54,'#cea16b','#78513e');c.strokeStyle='#60483c';c.lineWidth=2;c.beginPath();if(kind==='crate')c.roundRect(-20,-53,40,53,3);else c.ellipse(0,-28,22,28,0,0,TAU);c.fill();c.stroke();c.save();c.clip();for(let x=-19;x<22;x+=9){c.strokeStyle='#6e4e3f';c.beginPath();c.moveTo(x,-55);c.lineTo(x,2);c.stroke();c.strokeStyle='#edc68c6b';c.beginPath();c.moveTo(x+2,-55);c.lineTo(x+2,2);c.stroke();}if(kind==='crate'){c.strokeStyle='#e3b27c';c.lineWidth=7;c.beginPath();c.moveTo(-17,-48);c.lineTo(17,-6);c.moveTo(17,-48);c.lineTo(-17,-6);c.stroke();}else{c.fillStyle='#8e8794';c.fillRect(-26,-44,52,7);c.fillRect(-26,-17,52,7);c.fillStyle='#c9bdc1';c.fillRect(-26,-43,52,2);c.fillRect(-26,-16,52,2);}c.restore();}
function flowers(c:CanvasRenderingContext2D,t:number){for(let i=0;i<13;i++){const x=Math.sin(i*2.3)*40,y=-5-Math.cos(i*4)*13,h=16+i%3*9,dx=Math.sin(t+i)*2;c.strokeStyle='#5c8058';c.lineWidth=3;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x-4,y-h*.6,x+dx,y-h);c.stroke();ellipse(c,x-5,y-h*.4,7,3,'#77965c');for(let p=0;p<5;p++)ellipse(c,x+dx+Math.cos(p*TAU/5)*4,y-h+Math.sin(p*TAU/5)*4,3.5,3,['#e7c0d4','#e7d99d','#c2b2db'][i%3]);ellipse(c,x+dx,y-h,2,2,'#ddaf5e');}}
function fence(c:CanvasRenderingContext2D){c.strokeStyle='#b9a37b';c.lineWidth=5;c.beginPath();c.moveTo(-70,-18);c.lineTo(70,-18);c.moveTo(-70,-35);c.lineTo(70,-35);c.stroke();for(let i=0;i<7;i++){const x=-69+i*23;c.fillStyle='#e5d5af';c.beginPath();c.moveTo(x-4,0);c.lineTo(x-4,-44);c.lineTo(x,-50);c.lineTo(x+4,-44);c.lineTo(x+4,0);c.closePath();c.fill();}}
