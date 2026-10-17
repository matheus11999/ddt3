import {asset} from './appearance';
import type {AvatarPose} from './avatar';

type Point=readonly[number,number];
type Rect=readonly[number,number,number,number];
interface CostumeDefinition {path:string;anchors:readonly Point[];height:number;combatHeight:number;}
/** Each atlas is four paintings of one identity: idle, two steps, compact combat. */
export const COSTUMES:Readonly<Record<string,CostumeDefinition>>={
 'costume-thunder-chick':{path:'/assets/costumes/costume-thunder-chick.png',anchors:[[.595,.979],[.602,.979],[.60,.968],[.592,.95]],height:155,combatHeight:109},
 'costume-arcane-fox':{path:'/assets/costumes/costume-arcane-fox.png',anchors:[[.59,.967],[.575,.972],[.58,.96],[.59,.953]],height:155,combatHeight:109}
};
interface CostumeFrame {canvas:HTMLCanvasElement;source:Rect;anchor:Point;scale:number;}
const frames=new Map<string,CostumeFrame>(),portraits=new Map<string,HTMLCanvasElement>();
const createCanvas=(width:number,height:number)=>{const c=document.createElement('canvas');c.width=width;c.height=height;return c;};
/** Crop transparent gutters once; the origin remains the painted feet, never the tail/cape center. */
export function getCostumeFrame(id:string,index=0):CostumeFrame|null {
 const definition=COSTUMES[id];if(!definition)return null;
 const image=asset(definition.path);if(!image.complete||!image.naturalWidth)return null;
 const key=`${id}:${index}`,known=frames.get(key);if(known)return known;
 const side=image.naturalWidth/2,cell=createCanvas(side,side),c=cell.getContext('2d',{willReadFrequently:true})!;
 c.drawImage(image,(index%2)*side,Math.floor(index/2)*side,side,side,0,0,side,side);
 const pixels=c.getImageData(0,0,side,side).data;let left=side,right=0,top=side,bottom=0;
 for(let y=0;y<side;y++)for(let x=0;x<side;x++)if(pixels[(y*side+x)*4+3]>12){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
 if(left>=right||top>=bottom)return null;
 const width=right-left+1,height=bottom-top+1,out=createCanvas(width,height);out.getContext('2d')!.drawImage(cell,left,top,width,height,0,0,width,height);
 const anchor=definition.anchors[index],result={canvas:out,source:[left,top,width,height] as Rect,anchor:[anchor[0]*side-left,bottom-top+1] as Point,scale:definition.height/(side*.97)};
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
 const stepping=walk>.12&&(pose==='walk'||pose==='idle'),cycle=((phase/(Math.PI*2))%1+1)%1;
 const index=stepping?([1,0,2,0][Math.floor(cycle*4)]):combat||['aim','charge','fire','hit','prone','defeat'].includes(pose)?3:0;
 const frame=getCostumeFrame(id,index);if(!frame)return;
 const scale=frame.scale*(combat?definition.combatHeight/definition.height:1),recoil=pose==='fire'?Math.exp(-Math.max(0,poseTime)/145):0,hit=pose==='hit'?Math.exp(-Math.max(0,poseTime)/210):0;
 let rotation=animation.slope*.15-recoil*.09-hit*.16,y=0,squash=1;
 if(pose==='charge'){squash=.97;rotation+=.02;}
 if(pose==='aim')rotation+=(angle-45)*Math.PI/180*.035;
 if(pose==='fall')rotation+=Math.sin(time/180)*.12;
 if(pose==='prone'){rotation+=.14;squash=.78;}
 if(pose==='victory'){rotation-=.035;y=-Math.abs(Math.sin(time/260))*5;}
 if(pose==='defeat'){rotation+=.16;squash=.87;}
 // One opaque frame at each contact avoids ghost feet; all baselines stay on the same floor.
 c.save();c.translate(-recoil*3-hit*2,y);c.rotate(rotation);c.scale(scale,scale*squash);
 c.drawImage(frame.canvas,-frame.anchor[0],-frame.anchor[1]);c.restore();
}
