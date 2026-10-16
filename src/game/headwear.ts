import {DYES} from '../../shared/catalog';
import type {Equipment} from '../../shared/catalog';

type Point=readonly [number,number];
type Rect=readonly [number,number,number,number];
export type HeadwearProfile='covered'|'open';
/** Wearing art is registered to the scalp, independently from shop icon bounds. */
export const WORN_HEADWEAR:Readonly<Record<string,{source:Rect;contacts:readonly[Point,Point];seat:readonly[Point,Point];clip?:readonly Point[]}>>={
 'hat-cap':{source:[35,130,522,332],contacts:[[126,442],[485,330]],seat:[[430,410],[812,340]]},
 'hat-thunder':{source:[560,130,490,320],contacts:[[600,423],[960,333]],seat:[[430,410],[812,340]],clip:[[560,130],[1050,130],[1050,398],[1020,430],[1020,450],[560,450]]},
 'hat-tide':{source:[1030,130,500,330],contacts:[[1065,440],[1410,358]],seat:[[414,398],[828,350]],clip:[[1070,130],[1530,130],[1530,460],[1030,460],[1030,430],[1065,390],[1070,350]]},
 'hat-ruby':{source:[45,560,485,330],contacts:[[150,860],[485,785]],seat:[[430,405],[815,345]]},
 'hat-tropical':{source:[540,560,510,335],contacts:[[650,840],[945,760]],seat:[[425,405],[820,345]],clip:[[540,560],[1030,560],[1030,690],[1050,695],[1050,775],[1020,790],[1020,895],[540,895]]},
 'hat-mage':{source:[1035,480,495,410],contacts:[[1140,822],[1420,803]],seat:[[420,410],[830,365]],clip:[[1035,480],[1530,480],[1530,890],[1035,890],[1035,810],[1090,790],[1090,680],[1035,680]]}
};
const UNIT=160/1254;
const atlas=new Image();
atlas.src='/assets/headwear-worn-atlas.png';
atlas.onload=()=>window.dispatchEvent(new Event('brasa-art-loaded'));
const tinted=new Map<string,HTMLCanvasElement>();
const portraits=new Map<string,HTMLCanvasElement>();

export const hasWornHat=(id:string):boolean=>!!WORN_HEADWEAR[id];
function clipPiece(c:CanvasRenderingContext2D,points:readonly Point[]|undefined,origin:Point){
 if(!points)return;c.beginPath();points.forEach(([x,y],index)=>index?c.lineTo(x-origin[0],y-origin[1]):c.moveTo(x-origin[0],y-origin[1]));c.closePath();c.clip();
}
export function getWornHatPortrait(id:string):HTMLCanvasElement|null {
 const registration=WORN_HEADWEAR[id];if(!registration||!atlas.complete||!atlas.naturalWidth)return null;
 let portrait=portraits.get(id);
 if(!portrait){
  const [x,y,w,h]=registration.source;portrait=document.createElement('canvas');portrait.width=w;portrait.height=h;
  const c=portrait.getContext('2d')!;clipPiece(c,registration.clip,[x,y]);c.drawImage(atlas,x,y,w,h,0,0,w,h);portraits.set(id,portrait);
 }
 return portrait;
}

export function getHeadwearProfile(eq:Equipment):HeadwearProfile {
 return WORN_HEADWEAR[eq.hat]||eq.hat==='hat-knight'?'covered':'open';
}

function artFor(eq:Equipment):CanvasImageSource {
 const color=DYES.find(d=>d.id===eq.dyes?.hat&&d.id!=='original')?.color;
 if(!color)return atlas;
 let art=tinted.get(color);
 if(!art){
  art=document.createElement('canvas');art.width=atlas.naturalWidth;art.height=atlas.naturalHeight;
  const c=art.getContext('2d')!;c.drawImage(atlas,0,0);c.globalCompositeOperation='color';c.fillStyle=color;c.fillRect(0,0,art.width,art.height);
  c.globalCompositeOperation='destination-in';c.drawImage(atlas,0,0);tinted.set(color,art);
 }
 return art;
}

/** True means the painted hat owns this item, including while its image loads. */
export function drawWornHat(c:CanvasRenderingContext2D,eq:Equipment):boolean {
 const registration=WORN_HEADWEAR[eq.hat];if(!registration)return false;
 if(!atlas.complete||!atlas.naturalWidth)return true;
 const {source,contacts:[near,far],seat:[targetNear,targetFar]}=registration;
 const dx=far[0]-near[0],dy=far[1]-near[1],tx=targetFar[0]-targetNear[0],ty=targetFar[1]-targetNear[1],den=dx*dx+dy*dy;
 const a=(tx*dx+ty*dy)/den,b=(ty*dx-tx*dy)/den;
 c.save();c.translate((targetNear[0]-625)*UNIT,(targetNear[1]-1225)*UNIT);c.transform(a*UNIT,b*UNIT,-b*UNIT,a*UNIT,0,0);
 clipPiece(c,registration.clip,near);
 c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
 c.drawImage(artFor(eq),...source,source[0]-near[0],source[1]-near[1],source[2],source[3]);c.restore();
 return true;
}
