import {asset} from './appearance';
import type {AvatarPose} from './avatar';

type Point=readonly[number,number];
type Rect=readonly[number,number,number,number];
interface CostumeDefinition {path:string;height:number;combatHeight:number;}
/** Each atlas is four paintings of one identity: idle, two steps, compact combat.
 * Anchors are measured from the painting (see getCostumeFrame), never typed per costume. */
export const COSTUMES:Readonly<Record<string,CostumeDefinition>>={
 'costume-thunder-chick':{path:'/assets/costumes/costume-thunder-chick.png',height:155,combatHeight:109},
 'costume-arcane-fox':{path:'/assets/costumes/costume-arcane-fox.png',height:155,combatHeight:109}
};
/** Atlas cells: 0 idle, 1 and 2 the two walking contacts, 3 combat. */
export const COSTUME_WALK_FRAMES=[1,2] as const;
/** Avatar units travelled per painted step; slower than the cut-out rigs' 11 so paintings never strobe. */
export const COSTUME_STEP=30;
/** Share of the figure's height, from the top, whose centre locks the head in place between paintings. */
const HEAD_BAND=.42;
interface CostumeFrame {canvas:HTMLCanvasElement;source:Rect;anchor:Point;scale:number;cut:boolean;}
const frames=new Map<string,CostumeFrame>(),portraits=new Map<string,HTMLCanvasElement>();
const createCanvas=(width:number,height:number)=>{const c=document.createElement('canvas');c.width=width;c.height=height;return c;};
/** Splits the atlas into its four figures by connected painting, not by the grid: a wing tip
 * or staff that crosses into the neighbouring cell still belongs to its own figure. */
const owners=new Map<string,{side:number;owner:Int8Array;pixels:Uint8ClampedArray}>();
function atlasOwners(id:string,image:HTMLImageElement){
 const known=owners.get(id);if(known)return known;
 const size=image.naturalWidth,side=size/2,full=createCanvas(size,size),c=full.getContext('2d',{willReadFrequently:true})!;c.drawImage(image,0,0);
 const pixels=c.getImageData(0,0,size,size).data,owner=new Int8Array(size*size).fill(-1),seen=new Uint8Array(size*size),solid=(i:number)=>pixels[i*4+3]>12;
 for(let start=0;start<size*size;start++){
  if(seen[start]||!solid(start))continue;
  const members=[start],votes=[0,0,0,0];seen[start]=1;
  for(let k=0;k<members.length;k++){const i=members[k],x=i%size,y=(i-x)/size;votes[(y>=side?2:0)+(x>=side?1:0)]++;
   for(const n of [x>0?i-1:-1,x<size-1?i+1:-1,y>0?i-size:-1,y<size-1?i+size:-1])if(n>=0&&!seen[n]&&solid(n)){seen[n]=1;members.push(n);}}
  const cell=votes.indexOf(Math.max(...votes));for(const i of members)owner[i]=cell;
 }
 const result={side,owner,pixels};owners.set(id,result);return result;
}
/** Crop once. The origin is the painted feet line; horizontally it is the centre of the head,
 * so the face stays put while the cape, tail or staff change between paintings. */
export function getCostumeFrame(id:string,index=0):CostumeFrame|null {
 const definition=COSTUMES[id];if(!definition)return null;
 const image=asset(definition.path);if(!image.complete||!image.naturalWidth)return null;
 const key=`${id}:${index}`,known=frames.get(key);if(known)return known;
 const {side,owner,pixels}=atlasOwners(id,image),size=side*2;
 let left=size,right=0,top=size,bottom=0;
 for(let i=0;i<size*size;i++)if(owner[i]===index){const x=i%size,y=(i-x)/size;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
 if(left>=right||top>=bottom)return null;
 const width=right-left+1,height=bottom-top+1,out=createCanvas(width,height),c=out.getContext('2d')!,crop=c.createImageData(width,height);
 const band=top+height*HEAD_BAND;let sum=0,count=0;
 for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){const i=y*size+x;if(owner[i]!==index)continue;const o=((y-top)*width+x-left)*4;for(let k=0;k<4;k++)crop.data[o+k]=pixels[i*4+k];if(y<=band){sum+=x;count++;}}
 c.putImageData(crop,0,0);
 const result={canvas:out,source:[left-(index%2)*side,top-Math.floor(index/2)*side,width,height] as Rect,anchor:[sum/count-left,height] as Point,scale:definition.height/(side*.97),cut:left===0||top===0||right===size-1||bottom===size-1};
 frames.set(key,result);return result;
}

/** Item card and avatar share the exact idle painting, rather than separate illustrative icons. */
export function getCostumePortrait(id:string):HTMLCanvasElement|null {
 const known=portraits.get(id);if(known)return known;
 const frame=getCostumeFrame(id);if(!frame)return null;
 const out=createCanvas(512,512),c=out.getContext('2d')!,scale=Math.min(488/frame.canvas.width,488/frame.canvas.height),w=frame.canvas.width*scale,h=frame.canvas.height*scale;
 c.drawImage(frame.canvas,(512-w)/2,(512-h)/2,w,h);portraits.set(id,out);return out;
}

export interface CostumeAnimation {pose:AvatarPose;phase:number;walk:number;poseTime:number;angle:number;power:number;slope:number;combat:boolean;time:number;}
/** Grounded contact drawings are selected by travelled distance supplied by the common avatar motion. */
export function drawCostume(c:CanvasRenderingContext2D,id:string,animation:CostumeAnimation){
 const definition=COSTUMES[id];if(!definition)return;
 const {pose,phase,walk,poseTime,angle,combat,time}=animation;
 const stepping=!combat&&walk>.12&&(pose==='walk'||pose==='idle');
 // The shared motion advances phase by 2π every 44 units; one painted step lasts COSTUME_STEP units.
 const steps=phase/(Math.PI*2)*44/COSTUME_STEP,step=((steps%1)+1)%1;
 const index=stepping?COSTUME_WALK_FRAMES[Math.floor(steps)&1]:combat||['aim','charge','fire','hit','prone','defeat'].includes(pose)?3:0;
 const frame=getCostumeFrame(id,index);if(!frame)return;
 const scale=frame.scale*(combat?definition.combatHeight/definition.height:1),recoil=pose==='fire'?Math.exp(-Math.max(0,poseTime)/145):0,hit=pose==='hit'?Math.exp(-Math.max(0,poseTime)/210):0;
 let rotation=animation.slope*.15-recoil*.09-hit*.16,y=0,squash=1;
 // Paintings are still: the body rises between contacts and settles on each one, and idle breathes.
 if(stepping){const lift=Math.sin(step*Math.PI);y=-lift*3.2*walk;squash=1-(1-lift)*.025*walk;rotation+=.025*walk;}
 else if(pose==='idle'&&!combat)squash=1+Math.sin(time/700)*.008;
 if(pose==='charge'){squash=.97;rotation+=.02;}
 if(pose==='aim')rotation+=(angle-45)*Math.PI/180*.035;
 if(pose==='fall')rotation+=Math.sin(time/180)*.12;
 if(pose==='prone'){rotation+=.14;squash=.78;}
 if(pose==='victory'){rotation-=.035;y=-Math.abs(Math.sin(time/260))*5;}
 // Combat keeps the prone painting and crawls it: a forward surge and a small rock per stroke.
 let x=0;if(combat&&walk>.01){const stroke=Math.sin(phase);x=stroke*3*walk;y-=Math.abs(Math.cos(phase))*1.5*walk;rotation+=stroke*.035*walk;}
 if(pose==='defeat'){rotation+=.16;squash=.87;}
 // One opaque frame at each contact avoids ghost feet; all baselines stay on the same floor.
 c.save();c.translate(x-recoil*3-hit*2,y);c.rotate(rotation);c.scale(scale,scale*squash);
 c.drawImage(frame.canvas,-frame.anchor[0],-frame.anchor[1]);c.restore();
}
