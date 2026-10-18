import {asset} from './appearance';
import type {AvatarPose} from './avatar';
import {combatFrame} from './rig/combatFrames';

type Point=readonly[number,number];
type Rect=readonly[number,number,number,number];
/** A painted sprite sheet: `columns`×`rows` cells, one figure per cell, read left to right, top to bottom. */
export interface CostumeSheet {path:string;columns:number;rows:number;}
interface CostumeDefinition {path:string;height:number;combatHeight:number;walk?:CostumeSheet;prone?:CostumeSheet;throw?:CostumeSheet;}
/** Each costume has a 2×2 atlas (idle, two steps, standing combat) and, once painted, a 6-frame
 * walk cycle, a 6-frame belly-down combat sheet and a 6-frame throw sheet (rise, ready, wind-up,
 * release, follow-through, settle: docs/combat-frames.md) in the same standard as every outfit.
 * Anchors and scales are measured from the paintings (see costumeFrame), never typed per costume. */
const sheet=(path:string):CostumeSheet=>({path,columns:3,rows:2});
export const COSTUMES:Readonly<Record<string,CostumeDefinition>>={
 'costume-thunder-chick':{path:'/assets/costumes/costume-thunder-chick.png',height:155,combatHeight:109,walk:sheet('/assets/costumes/costume-thunder-chick-walk.png'),prone:sheet('/assets/costumes/costume-thunder-chick-prone.png')},
 'costume-arcane-fox':{path:'/assets/costumes/costume-arcane-fox.png',height:155,combatHeight:109,walk:sheet('/assets/costumes/costume-arcane-fox-walk.png'),prone:sheet('/assets/costumes/costume-arcane-fox-prone.png')}
};
/** Atlas cells: 0 idle, 1 and 2 the two walking contacts, 3 combat. Used only without a walk sheet. */
export const COSTUME_WALK_FRAMES=[1,2] as const;
/** Avatar units travelled per painted step; slower than the cut-out rigs' 11 so paintings never strobe. */
export const COSTUME_STEP=30;
/** Walk sheet: frames 0-2 are one step (contact, down, passing), 3-5 the other. Units per frame. */
export const COSTUME_WALK_FRAME=16;
/** Belly-down sheet frames. */
export const PRONE_FRAMES={rest:0,crawlA:1,crawlB:2,charge:3,throw:4,hurt:5} as const;
/** Height of the resting belly-down painting in avatar units, close to the outfits' prone body with its head. */
export const COSTUME_PRONE_HEIGHT=92;
/** Share of the figure's height, from the top, whose centre locks the head in place between paintings. */
const HEAD_BAND=.42;
/** Share of the figure's height, from the bottom, whose centre is the belly-down body's contact point. */
const GROUND_BAND=.3;
export interface CostumeFrame {canvas:HTMLCanvasElement;source:Rect;anchor:Point;scale:number;cut:boolean;head:number;}
const frames=new Map<string,CostumeFrame>(),portraits=new Map<string,HTMLCanvasElement>();
const createCanvas=(width:number,height:number)=>{const c=document.createElement('canvas');c.width=width;c.height=height;return c;};
/** Splits a sheet into its figures by connected painting, not by the grid: a wing tip or staff
 * that crosses into the neighbouring cell still belongs to its own figure. */
const owners=new Map<string,{width:number;cellW:number;cellH:number;owner:Int8Array;pixels:Uint8ClampedArray}>();
function sheetOwners(sheet:CostumeSheet,image:HTMLImageElement){
 const known=owners.get(sheet.path);if(known)return known;
 const width=image.naturalWidth,height=image.naturalHeight,cellW=width/sheet.columns,cellH=height/sheet.rows,full=createCanvas(width,height),c=full.getContext('2d',{willReadFrequently:true})!;c.drawImage(image,0,0);
 const pixels=c.getImageData(0,0,width,height).data,owner=new Int8Array(width*height).fill(-1),seen=new Uint8Array(width*height),solid=(i:number)=>pixels[i*4+3]>12;
 for(let start=0;start<width*height;start++){
  if(seen[start]||!solid(start))continue;
  const members=[start],votes=new Array(sheet.columns*sheet.rows).fill(0);seen[start]=1;
  for(let k=0;k<members.length;k++){const i=members[k],x=i%width,y=(i-x)/width;votes[Math.min(sheet.rows-1,Math.floor(y/cellH))*sheet.columns+Math.min(sheet.columns-1,Math.floor(x/cellW))]++;
   for(const n of [x>0?i-1:-1,x<width-1?i+1:-1,y>0?i-width:-1,y<height-1?i+width:-1])if(n>=0&&!seen[n]&&solid(n)){seen[n]=1;members.push(n);}}
  const cell=votes.indexOf(Math.max(...votes));for(const i of members)owner[i]=cell;
 }
 const result={width,cellW,cellH,owner,pixels};owners.set(sheet.path,result);return result;
}
/** Crops one figure. The origin is its lowest painted line; horizontally it is the centre of the head
 * for standing paintings (the face stays put while cape, tail or staff change) or the centre of the
 * body on the ground for belly-down ones. `scale` maps the sheet's pixels to avatar units. */
export function costumeFrame(sheet:CostumeSheet,index:number,lock:'head'|'ground'='head'):Omit<CostumeFrame,'scale'>|null {
 const image=asset(sheet.path);if(!image.complete||!image.naturalWidth)return null;
 const key=`${sheet.path}:${index}:${lock}`,known=frames.get(key);if(known)return known;
 const {width,cellW,cellH,owner,pixels}=sheetOwners(sheet,image),height=pixels.length/4/width;
 let left=width,right=0,top=height,bottom=0;
 for(let i=0;i<width*height;i++)if(owner[i]===index){const x=i%width,y=(i-x)/width;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
 if(left>=right||top>=bottom)return null;
 const w=right-left+1,h=bottom-top+1,out=createCanvas(w,h),c=out.getContext('2d')!,crop=c.createImageData(w,h);
 const headBand=top+h*HEAD_BAND,groundBand=bottom-h*GROUND_BAND;let headSum=0,headCount=0,groundSum=0,groundCount=0;
 for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){const i=y*width+x;if(owner[i]!==index)continue;const o=((y-top)*w+x-left)*4;for(let k=0;k<4;k++)crop.data[o+k]=pixels[i*4+k];if(y<=headBand){headSum+=x;headCount++;}if(y>=groundBand){groundSum+=x;groundCount++;}}
 c.putImageData(crop,0,0);
 const head=headSum/headCount-left,ground=groundSum/groundCount-left;
 const result={canvas:out,source:[left-(index%sheet.columns)*cellW,top-Math.floor(index/sheet.columns)*cellH,w,h] as Rect,anchor:[lock==='head'?head:ground,h] as Point,scale:1,cut:left===0||top===0||right===width-1||bottom===height-1,head};
 frames.set(key,result);return result;
}
const atlasOf=(definition:CostumeDefinition):CostumeSheet=>({path:definition.path,columns:2,rows:2});
/** Idle/step/combat atlas frame in avatar units. */
export function getCostumeFrame(id:string,index=0):CostumeFrame|null {
 const definition=COSTUMES[id];if(!definition)return null;
 // Start loading the walk and belly-down sheets with the first painting, before they are needed.
 if(definition.walk)asset(definition.walk.path);if(definition.prone)asset(definition.prone.path);
 const frame=costumeFrame(atlasOf(definition),index);if(!frame)return null;
 const image=asset(definition.path);return {...frame,scale:definition.height/(image.naturalHeight/2*.97)};
}
/** Walk-cycle frame, scaled so the two contact paintings stand as tall as the idle one. */
export function getCostumeWalkFrame(id:string,index:number):CostumeFrame|null {
 const definition=COSTUMES[id],sheet=definition?.walk;if(!sheet)return null;
 const idle=getCostumeFrame(id,0),frame=costumeFrame(sheet,index),a=costumeFrame(sheet,0),b=costumeFrame(sheet,3);if(!idle||!frame||!a||!b)return null;
 return {...frame,scale:idle.canvas.height*idle.scale/((a.canvas.height+b.canvas.height)/2)};
}
/** Belly-down combat frame, scaled so the resting painting is COSTUME_PRONE_HEIGHT units tall. */
/** Standing throw frame (rise..settle), scaled so the ready painting is as tall as the standing combat costume. */
export function getCostumeThrowFrame(id:string,index:number):CostumeFrame|null {
 const definition=COSTUMES[id],sheet=definition?.throw;if(!sheet)return null;
 const ready=costumeFrame(sheet,1,'ground'),frame=costumeFrame(sheet,index,'ground');if(!ready||!frame)return null;
 return {...frame,scale:definition.combatHeight/ready.canvas.height};
}
export function getCostumeProneFrame(id:string,index:number):CostumeFrame|null {
 const sheet=COSTUMES[id]?.prone;if(!sheet)return null;
 const rest=costumeFrame(sheet,PRONE_FRAMES.rest,'ground'),frame=costumeFrame(sheet,index,'ground');if(!rest||!frame)return null;
 return {...frame,scale:COSTUME_PRONE_HEIGHT/rest.canvas.height};
}
export const hasProneCostume=(id:string)=>!!COSTUMES[id]?.prone;

/** Item card and avatar share the exact idle painting, rather than separate illustrative icons. */
export function getCostumePortrait(id:string):HTMLCanvasElement|null {
 const known=portraits.get(id);if(known)return known;
 const frame=getCostumeFrame(id);if(!frame)return null;
 const out=createCanvas(512,512),c=out.getContext('2d')!,scale=Math.min(488/frame.canvas.width,488/frame.canvas.height),w=frame.canvas.width*scale,h=frame.canvas.height*scale;
 c.drawImage(frame.canvas,(512-w)/2,(512-h)/2,w,h);portraits.set(id,out);return out;
}

export interface CostumeAnimation {pose:AvatarPose;phase:number;walk:number;poseTime:number;angle:number;power:number;slope:number;combat:boolean;time:number;}
const draw=(c:CanvasRenderingContext2D,frame:CostumeFrame,x:number,y:number,rotation:number,squash:number)=>{
 c.save();c.translate(x,y);c.rotate(rotation);c.scale(frame.scale,frame.scale*squash);c.drawImage(frame.canvas,-frame.anchor[0],-frame.anchor[1]);c.restore();
};
/** Belly-down combat, the same pose standard as every outfit: crawl strokes, wind-up, throw, flinch. */
const THROW_FRAMES=['rise','ready','windup','release','follow','settle'] as const;
function drawProne(c:CanvasRenderingContext2D,id:string,animation:CostumeAnimation):boolean {
 const {pose,phase,walk,poseTime,time}=animation;
 // Rising to throw, as every outfit does, once the costume's throw sheet is painted.
 const action=combatFrame(pose,poseTime,phase,walk),standing=(THROW_FRAMES as readonly string[]).indexOf(action);
 if(standing>=0&&COSTUMES[id]?.throw){const frame=getCostumeThrowFrame(id,standing);if(frame){draw(c,frame,0,0,animation.slope,1);return true;}}
 const fire=pose==='fire'&&poseTime<380,hurt=pose==='hit'||pose==='defeat'||pose==='fall';
 const crawling=walk>.12&&!fire&&pose!=='charge'&&!hurt;
 const index=crawling?(Math.sin(phase)>=0?PRONE_FRAMES.crawlA:PRONE_FRAMES.crawlB):pose==='charge'?PRONE_FRAMES.charge:fire?PRONE_FRAMES.throw:hurt?PRONE_FRAMES.hurt:PRONE_FRAMES.rest;
 const frame=getCostumeProneFrame(id,index);if(!frame)return false;
 const hit=pose==='hit'?Math.exp(-Math.max(0,poseTime)/210):0,recoil=pose==='fire'?Math.exp(-Math.max(0,poseTime)/145):0;
 // Like every fighter, the whole body lies along the ground under it.
 let x=-recoil*2-hit*3,y=0,rotation=animation.slope,squash=1;
 if(crawling){const stroke=Math.sin(phase);x+=stroke*2.5*walk;y-=Math.abs(Math.cos(phase))*1.2*walk;}
 else if(pose==='idle'||pose==='aim'||pose==='prone')squash=1+Math.sin(time/900)*.012;
 if(pose==='charge')squash=.98;
 if(pose==='fall')rotation+=Math.sin(time/180)*.12;
 if(pose==='defeat')squash=.94;
 draw(c,frame,x,y,rotation,squash);return true;
}
/** Grounded contact drawings are selected by travelled distance supplied by the common avatar motion. */
export function drawCostume(c:CanvasRenderingContext2D,id:string,animation:CostumeAnimation){
 const definition=COSTUMES[id];if(!definition)return;
 if(animation.combat&&drawProne(c,id,animation))return;
 const {pose,phase,walk,poseTime,angle,combat,time}=animation;
 const stepping=!combat&&walk>.12&&(pose==='walk'||pose==='idle');
 // The shared motion advances phase by 2π every 44 units.
 const travelled=phase/(Math.PI*2)*44;
 const sheetFrame=stepping&&definition.walk?getCostumeWalkFrame(id,((Math.floor(travelled/COSTUME_WALK_FRAME)%6)+6)%6):null;
 const steps=travelled/COSTUME_STEP,step=((steps%1)+1)%1;
 const frame=sheetFrame??getCostumeFrame(id,stepping?COSTUME_WALK_FRAMES[Math.floor(steps)&1]:combat||['aim','charge','fire','hit','prone','defeat'].includes(pose)?3:0);if(!frame)return;
 const scale=combat?definition.combatHeight/definition.height:1,recoil=pose==='fire'?Math.exp(-Math.max(0,poseTime)/145):0,hit=pose==='hit'?Math.exp(-Math.max(0,poseTime)/210):0;
 let rotation=animation.slope*.15-recoil*.09-hit*.16,y=0,squash=1;
 // Two still paintings need a code bob between contacts; a painted cycle carries its own.
 if(stepping&&!sheetFrame){const lift=Math.sin(step*Math.PI);y=-lift*3.2*walk;squash=1-(1-lift)*.025*walk;rotation+=.025*walk;}
 else if(pose==='idle'&&!combat)squash=1+Math.sin(time/700)*.008;
 if(pose==='charge'){squash=.97;rotation+=.02;}
 if(pose==='aim')rotation+=(angle-45)*Math.PI/180*.035;
 if(pose==='fall')rotation+=Math.sin(time/180)*.12;
 if(pose==='prone'){rotation+=.14;squash=.78;}
 if(pose==='victory'){rotation-=.035;y=-Math.abs(Math.sin(time/260))*5;}
 let x=0;if(combat&&walk>.01){const stroke=Math.sin(phase);x=stroke*3*walk;y-=Math.abs(Math.cos(phase))*1.5*walk;rotation+=stroke*.035*walk;}
 if(pose==='defeat'){rotation+=.16;squash=.87;}
 c.save();c.scale(scale,scale);draw(c,frame,x-recoil*3-hit*2,y,rotation,squash);c.restore();
}
