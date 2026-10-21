import type {Equipment} from '../../shared/catalog';
import {asset} from './appearance';
import {tintSkin} from './recolor';
import {drawCell,freeAll} from './spriteCache';
import {walkFrameIndex} from './walkBody';
import atlas from './frontAtlas.json';
import fits from './rig/frontFit.json';

/**
 * FRONT view (pedido do matheus, 21/10): outside battle (bag, rooms, shop, lobby, fishing) the character is drawn in a
 * 3/4 front view like the DDTank bag portrait; battle keeps the side view. Art and fits come from the front kit
 * (scripts/front-kit-prompts.mjs, scripts/build-front-sheets.py, `npm run verify:front`); a look shows in front view
 * only when every visible piece has front art, otherwise the side view is drawn as before.
 *
 * Front head template (1254 px): crown (634,182), neck stub bottom (635,642). Distances below are avatar units
 * (the side view's 160-unit figure): the body is BODY_UNITS from collar to soles and the head HEAD_UNITS from crown to
 * the neck stub.
 */
interface StandEntry {path:string;collar:[number,number];soles:number;}
interface SheetEntry {path:string;cell:number;frames:{neck:[number,number];headHeight:number;soles:number}[];}
const STAND=atlas.stand as unknown as Record<string,StandEntry>,WALK=atlas.walk as unknown as Record<string,SheetEntry>,IDLE=atlas.idle as unknown as Record<string,SheetEntry>;
const FITS=fits as unknown as Record<string,[number,number,number]>;
const SIZE=1254,CROWN=[634,182] as const,NECK=[635,642] as const,HEAD_PX=NECK[1]-CROWN[1];
const BODY_UNITS=80,HEAD_UNITS=72;
/** Long hair is drawn once behind the head (the part falling on the back) and again in front. */
const LONG_HAIR=new Set(['hair-basic-female']);
const FACES=new Set(['face-basic-male','face-basic-female']);
const art=(id:string)=>asset(`/assets/front/${id}.png`);
const ready=(image:HTMLImageElement)=>image.complete&&image.naturalWidth>0;
const heads=new Map<string,HTMLCanvasElement>();

/** Whether this look has front art for every visible piece (else the side view is drawn). */
export function hasFrontView(eq:Equipment):boolean {
 const costume=eq.costume!=='costume-none'&&eq.visibility?.costume!==false;
 const hat=eq.visibility?.hat===false?'hat-none':eq.hat,glasses=eq.visibility?.glasses===false?'glasses-none':eq.glasses;
 return !costume&&!!STAND[eq.outfit]&&FACES.has(eq.face)&&!!FITS[eq.hair]&&(hat==='hat-none'||!!FITS[hat])&&glasses==='glasses-none';
}

function placed(image:HTMLImageElement,[k,dx,dy]:[number,number,number]):HTMLCanvasElement {
 const out=document.createElement('canvas');out.width=out.height=SIZE;
 out.getContext('2d')!.drawImage(image,CROWN[0]-CROWN[0]*k+dx,CROWN[1]-CROWN[1]*k+dy,image.naturalWidth*k,image.naturalHeight*k);
 return out;
}
/** Hair under a hat: nothing of it shows above the hat's lower edge (scripts/verify-front.py under_hat). */
function underHat(hair:HTMLCanvasElement,hat:HTMLCanvasElement){
 const hc=hair.getContext('2d',{willReadFrequently:true})!,h=hc.getImageData(0,0,SIZE,SIZE),a=hat.getContext('2d',{willReadFrequently:true})!.getImageData(0,0,SIZE,SIZE).data;
 const bottom=new Int32Array(SIZE).fill(-1);
 for(let x=0;x<SIZE;x++)for(let y=SIZE-1;y>=0;y--)if(a[(y*SIZE+x)*4+3]>128){bottom[x]=y;break;}
 const covered=[...bottom].filter(y=>y>=0).sort((p,q)=>p-q),band=covered.length?covered[covered.length>>1]:0;
 for(let x=0;x<SIZE;x++){const limit=bottom[x]>=0?bottom[x]:band;for(let y=0;y<limit;y++)h.data[(y*SIZE+x)*4+3]=0;}
 hc.putImageData(h,0,0);
}
/** The composed front head (back hair, face with the body color, hair, hat) on the 1254 template, or null while loading. */
function frontHead(eq:Equipment):HTMLCanvasElement|null {
 const hatId=eq.visibility?.hat===false?'hat-none':eq.hat,key=[eq.face,eq.hair,hatId,eq.skin??''].join(':'),known=heads.get(key);if(known)return known;
 const face=art(eq.face),hair=art(eq.hair),hat=hatId==='hat-none'?null:art(hatId);
 if(!ready(face)||!ready(hair)||hat&&!ready(hat))return null;
 const hairLayer=placed(hair,FITS[eq.hair]),hatLayer=hat?placed(hat,FITS[hatId]):null;if(hatLayer)underHat(hairLayer,hatLayer);
 const skin=document.createElement('canvas');skin.width=skin.height=SIZE;skin.getContext('2d')!.drawImage(face,0,0,SIZE,SIZE);tintSkin(skin,eq.skin);
 const out=document.createElement('canvas');out.width=out.height=SIZE;const c=out.getContext('2d')!;
 if(LONG_HAIR.has(eq.hair))c.drawImage(hairLayer,0,0);
 c.drawImage(skin,0,0);c.drawImage(hairLayer,0,0);if(hatLayer)c.drawImage(hatLayer,0,0);
 heads.set(key,out);if(heads.size>32){const oldest=heads.keys().next().value!;heads.delete(oldest);}
 return out;
}
/** Draws the front head with its neck stub bottom at (x,y), in avatar units. */
function drawHead(c:CanvasRenderingContext2D,head:HTMLCanvasElement,x:number,y:number,tilt=0){
 const k=HEAD_UNITS/HEAD_PX;c.save();c.translate(x,y);c.rotate(tilt);c.imageSmoothingQuality='high';
 drawCell(c,head,0,0,SIZE,SIZE,-NECK[0]*k,-NECK[1]*k,SIZE*k,SIZE*k);c.restore();
}
const bodies=new Map<string,HTMLCanvasElement>();
/** A body painting with the character's body color, or null while it loads. */
function body(path:string,skin?:string):HTMLCanvasElement|null {
 const image=asset(path);if(!ready(image))return null;const key=`${path}:${skin??''}`,known=bodies.get(key);if(known)return known;
 const out=document.createElement('canvas');out.width=image.naturalWidth;out.height=image.naturalHeight;out.getContext('2d')!.drawImage(image,0,0);tintSkin(out,skin,true);
 bodies.set(key,out);return out;
}

export type FrontBody='stand'|'idle'|'walk';
/**
 * Draws the whole front figure facing right with its feet at (0,0), in avatar units. `stand` is the posed painting of
 * the previews, `idle` and `walk` the lobby sheets (`distance` picks the walk frame). Returns false while art loads.
 */
export function drawFrontAvatar(c:CanvasRenderingContext2D,eq:Equipment,kind:FrontBody,distance=0,tilt=0):boolean {
 const head=frontHead(eq);if(!head)return false;
 const sheet=kind==='walk'?WALK[eq.outfit]:kind==='idle'?IDLE[eq.outfit]:null;
 if(sheet){
  const image=body(sheet.path,eq.skin);if(!image)return false;
  const index=kind==='walk'?walkFrameIndex(distance)%sheet.frames.length:0,frame=sheet.frames[index],s=HEAD_UNITS/frame.headHeight,cell=sheet.cell;
  drawCell(c,image,(index%3)*cell,Math.floor(index/3)*cell,cell,cell,-cell/2*s,-frame.soles*s,cell*s,cell*s);
  drawHead(c,head,(frame.neck[0]-cell/2)*s,(frame.neck[1]-frame.soles)*s,tilt);return true;
 }
 const stand=STAND[eq.outfit],image=body(stand.path,eq.skin);if(!image)return false;
 const [cx,cy]=stand.collar,s=BODY_UNITS/(stand.soles-cy);
 drawCell(c,image,0,0,image.width,image.height,-cx*s,-stand.soles*s,image.width*s,image.height*s);
 drawHead(c,head,0,(cy+12-stand.soles)*s,tilt);return true;
}
/** Head only, for portraits: the neck stub bottom at (0,0), HEAD_UNITS tall. Returns false while art loads. */
export function drawFrontHead(c:CanvasRenderingContext2D,eq:Equipment):boolean {
 const head=frontHead(eq);if(!head)return false;drawHead(c,head,0,0);return true;
}
export const FRONT_HEAD_UNITS=HEAD_UNITS;
/** Front art is for the plaza, the Pescaria and the menus: let go while a battle covers them. */
export function releaseFrontArt(){freeAll(heads);freeAll(bodies);}
