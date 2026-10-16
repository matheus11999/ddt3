import type {MapId, Weapon} from './catalog';
import {canonicalMap,contains,getMap,MATERIALS} from './maps';
import type {CanonicalMapId,MaterialId,MapRegion} from './maps';
export const WORLD={width:1536,height:864,cell:3,cols:512,rows:288};
interface TerrainTemplate {solid:Uint8Array;regions:Int16Array;definition:readonly MapRegion[];}
const templates=new Map<CanonicalMapId,TerrainTemplate>();
export function terrainTemplate(map:MapId='garden'):TerrainTemplate {
 const id=canonicalMap(map),cached=templates.get(id);if(cached)return cached;
 const definition=getMap(id).regions,solid=new Uint8Array(WORLD.cols*WORLD.rows),regions=new Int16Array(solid.length).fill(-1);
 // Scan-convert polygons once per row, not once per cell: large illustrated contours
 // remain cheap to initialise on both the server and lower-powered browsers.
 for(let r=0;r<definition.length;r++){
  const shape=definition[r].shape;
  if(shape.kind==='polygon'){
   const points=shape.points,minY=Math.max(0,Math.ceil(Math.min(...points.map(p=>p[1]))/3)),maxY=Math.min(WORLD.rows,Math.ceil(Math.max(...points.map(p=>p[1]))/3));
   for(let cy=minY;cy<maxY;cy++){const y=cy*3,intersections:number[]=[];
    for(let n=0,j=points.length-1;n<points.length;j=n++){const [ax,ay]=points[n],[bx,by]=points[j];if((ay>y)!==(by>y))intersections.push((bx-ax)*(y-ay)/(by-ay)+ax);}
    intersections.sort((a,b)=>a-b);
    for(let n=0;n<intersections.length;n+=2){const left=Math.max(0,Math.ceil(intersections[n]/3)),right=Math.min(WORLD.cols,Math.ceil(intersections[n+1]/3));for(let cx=left;cx<right;cx++){const i=cy*WORLD.cols+cx;solid[i]=1;regions[i]=r;}}
   }
  }else{
   const bounds=shape.kind==='rect'?[shape.x,shape.y,shape.x+shape.width,shape.y+shape.height]:[shape.x-shape.rx,shape.y-shape.ry,shape.x+shape.rx,shape.y+shape.ry];
   for(let cy=Math.max(0,Math.floor(bounds[1]/3));cy<Math.min(WORLD.rows,Math.ceil(bounds[3]/3)+1);cy++)for(let cx=Math.max(0,Math.floor(bounds[0]/3));cx<Math.min(WORLD.cols,Math.ceil(bounds[2]/3)+1);cx++)if(contains(shape,cx*3,cy*3)){const i=cy*WORLD.cols+cx;solid[i]=1;regions[i]=r;}
  }
 }
 const value={solid,regions,definition};templates.set(id,value);return value;
}
export function createTerrain(map:MapId='garden'):Uint8Array{return terrainTemplate(map).solid.slice();}
export function terrainMaterial(map:MapId,x:number,y:number):{material:MaterialId;destructible:boolean;region?:string}{
 const template=terrainTemplate(map);const cx=Math.floor(x/3),cy=Math.floor(y/3);
 if(cx<0||cx>=WORLD.cols||cy<0||cy>=WORLD.rows)return {material:'earth',destructible:false};
 const r=template.definition[template.regions[cy*WORLD.cols+cx]];return r?{material:r.material,destructible:r.destructible,region:r.id}:{material:'earth',destructible:false};
}
export function solid(t:Uint8Array,x:number,y:number){if(x<0||x>=WORLD.width||y<0||y>=WORLD.height)return false;return t[Math.floor(y/3)*WORLD.cols+Math.floor(x/3)]===1;}
export function ground(t:Uint8Array,x:number,start=0){for(let y=Math.max(0,Math.floor(start/3)*3);y<WORLD.height;y+=3){if(solid(t,x,y))return y;}return WORLD.height+80;}
export function crater(t:Uint8Array,x:number,y:number,r:number,map:MapId='garden'){
 const template=terrainTemplate(map);let removed=0;const extent=r/Math.sqrt(.72);
 for(let cy=Math.max(0,Math.floor((y-extent)/3));cy<Math.min(WORLD.rows,Math.ceil((y+extent)/3));cy++)
 for(let cx=Math.max(0,Math.floor((x-extent)/3));cx<Math.min(WORLD.cols,Math.ceil((x+extent)/3));cx++){
  const i=cy*WORLD.cols+cx;if(!t[i])continue;const region=template.definition[template.regions[i]];
  if(!region?.destructible)continue;
  const radius=r/Math.sqrt(MATERIALS[region.material].resistance);
  if((cx*3-x)**2+(cy*3-y)**2<=radius*radius){t[i]=0;removed++;}
 }
 return removed;
}
export function packTerrain(t:Uint8Array):Uint8Array{const b=new Uint8Array(Math.ceil(t.length/8));for(let i=0;i<t.length;i++)if(t[i])b[i>>3]|=1<<(i%8);return b;}
export function unpackTerrain(b:Uint8Array){const t=new Uint8Array(WORLD.cols*WORLD.rows);for(let i=0;i<t.length;i++)t[i]=(b[i>>3]>>(i%8))&1;return t;}
export function trajectory(terrain:Uint8Array,origin:{x:number;y:number;facing:number},angle:number,power:number,wind:number,weapon:Weapon,targets:{id:string;x:number;y:number;hp:number}[]=[]){
 const rad=angle*Math.PI/180,speed=power*9.8;
 let x=origin.x+origin.facing*27,y=origin.y-40,vx=Math.cos(rad)*speed*origin.facing,vy=-Math.sin(rad)*speed;
 const points:number[][]=[[x,y]];let hitId:string|undefined;
 for(let frame=0;frame<900;frame++){
  // 120 Hz fixed integration; samples at 60 Hz for smooth client playback.
  x+=vx/120;y+=vy/120;vx+=wind*7/120;vy+=weapon.gravity/120;
  if(frame%2===0)points.push([Math.round(x*10)/10,Math.round(y*10)/10]);
  const hit=targets.find(p=>p.hp>0&&Math.hypot(x-p.x,y-(p.y-31))<24);
  if(hit||solid(terrain,x,y)||y>WORLD.height+50||x<-80||x>WORLD.width+80){hitId=hit?.id;break;}
 }
 points.push([x,y]);return {points,x,y,hitId};
}
