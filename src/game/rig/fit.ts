import {FACE_KEEPOUT,FIT_ZONES,FRAME_MARGIN,HEAD_ANCHORS,HEAD_WIDTH,BODY_PROPORTIONS} from './anchors';
import type {FitClass} from './anchors';
import {COSMETIC_MANIFEST} from './manifest';

/** Alpha coverage in template space: pixel (x,y) is template (x-originX, y-originY). */
export interface FitMask {width:number;height:number;originX:number;originY:number;data:Uint8Array;}
export interface Bounds {x:number;y:number;width:number;height:number;area:number;}
export interface FitIssue {code:'width'|'height'|'bottom'|'top'|'frame'|'keepout'|'hidden'|'proportion'|'unregistered'|'anchor';message:string;measured:number;limit:number;}
export interface FitReport {id:string;fit?:FitClass;bounds:Bounds|null;widthRatio:number;issues:FitIssue[];}

export function maskFromAlpha(rgba:Uint8ClampedArray,width:number,height:number,originX:number,originY:number,threshold=40):FitMask{
 const data=new Uint8Array(width*height);for(let i=0;i<data.length;i++)data[i]=rgba[i*4+3]>threshold?1:0;
 return {width,height,originX,originY,data};
}
export function maskBounds(mask:FitMask):Bounds|null{
 let left=Infinity,right=-1,top=Infinity,bottom=-1,area=0;
 for(let y=0;y<mask.height;y++)for(let x=0;x<mask.width;x++)if(mask.data[y*mask.width+x]){area++;if(x<left)left=x;if(x>right)right=x;if(y<top)top=y;if(y>bottom)bottom=y;}
 return area?{x:left-mask.originX,y:top-mask.originY,width:right-left+1,height:bottom-top+1,area}:null;
}
/** Painted pixels over the eyes and mouth of the universal face. */
export function keepoutPixels(mask:FitMask):number{
 let count=0;
 for(const {center:[cx,cy],radius:[rx,ry]} of FACE_KEEPOUT)
  for(let y=Math.floor(cy-ry);y<=cy+ry;y++)for(let x=Math.floor(cx-rx);x<=cx+rx;x++){
   if(((x-cx)/rx)**2+((y-cy)/ry)**2>1)continue;
   const px=x+mask.originX,py=y+mask.originY;
   if(px>=0&&py>=0&&px<mask.width&&py<mask.height&&mask.data[py*mask.width+px])count++;
  }
 return count;
}
const fmt=(n:number)=>Number(n.toFixed(2));
/** Checks one cosmetic, drawn alone on the universal head, against its slot zone. */
/** Pins must land on the universal anchors: hats on the hat seat, glasses on the eye sockets. */
export function evaluatePin(id:string,tolerance=4):FitIssue|null{
 const manifest=COSMETIC_MANIFEST[id],target=manifest?.slot==='hat'?HEAD_ANCHORS.hatSeat:manifest?.slot==='glasses'?[HEAD_ANCHORS.nearEye,HEAD_ANCHORS.farEye]:null;
 if(!manifest?.worn||!target)return null;
 const offset=Math.round(Math.max(...manifest.worn.pin.to.map((point,index)=>Math.hypot(point[0]-target[index][0],point[1]-target[index][1]))));
 return offset>tolerance?{code:'anchor',message:`Assento ${offset}px fora da âncora universal`,measured:offset,limit:tolerance}:null;
}
export function evaluateItem(id:string,mask:FitMask):FitReport{
 const fit=COSMETIC_MANIFEST[id]?.fit,bounds=maskBounds(mask),issues:FitIssue[]=[];
 const widthRatio=bounds?fmt(bounds.width/HEAD_WIDTH):0;
 if(!fit){issues.push({code:'unregistered',message:'Item sem classe de encaixe registrada',measured:0,limit:0});return {id,bounds,widthRatio,issues};}
 if(!bounds)return {id,fit,bounds,widthRatio,issues};
 const zone=FIT_ZONES[fit],size=HEAD_ANCHORS.atlasSize;
 if(widthRatio>zone.maxWidth)issues.push({code:'width',message:`Largura ${widthRatio}× a cabeça; limite ${zone.maxWidth}×`,measured:widthRatio,limit:zone.maxWidth});
 if(zone.minWidth&&widthRatio<zone.minWidth)issues.push({code:'width',message:`Largura ${widthRatio}× a cabeça; mínimo ${zone.minWidth}×`,measured:widthRatio,limit:zone.minWidth});
 const above=fmt((HEAD_ANCHORS.crown[1]-bounds.y)/HEAD_WIDTH);
 if(above>zone.maxAboveCrown)issues.push({code:'height',message:`Sobe ${above}× acima do crânio; limite ${zone.maxAboveCrown}×`,measured:above,limit:zone.maxAboveCrown});
 const bottom=bounds.y+bounds.height-1;
 if(bottom>zone.maxBottom)issues.push({code:'bottom',message:`Desce até y=${bottom}; limite y=${zone.maxBottom}`,measured:bottom,limit:zone.maxBottom});
 if(zone.minTop!==undefined&&bounds.y<zone.minTop)issues.push({code:'top',message:`Começa em y=${bounds.y}, acima da sobrancelha; limite y=${zone.minTop}`,measured:bounds.y,limit:zone.minTop});
 const outside=Math.max(FRAME_MARGIN-bounds.x,FRAME_MARGIN-bounds.y,bounds.x+bounds.width-(size-FRAME_MARGIN),bounds.y+bounds.height-(size-FRAME_MARGIN));
 if(outside>0)issues.push({code:'frame',message:`Ultrapassa a margem do quadro de ${size}px em ${outside}px`,measured:outside,limit:0});
 if(zone.keepoutTolerance!==null){const covered=keepoutPixels(mask);if(covered>zone.keepoutTolerance)issues.push({code:'keepout',message:`Cobre olhos/boca em ${covered}px`,measured:covered,limit:zone.keepoutTolerance});}
 const pin=evaluatePin(id);if(pin)issues.push(pin);
 return {id,fit,bounds,widthRatio,issues};
}
/** Paid glasses must stay visible under any hair and hat. */
export function evaluateGlassesVisibility(id:string,alone:FitMask,visible:FitMask,minimum=.9):FitIssue|null{
 let total=0,shown=0;for(let i=0;i<alone.data.length;i++)if(alone.data[i]){total++;if(visible.data[i])shown++;}
 const share=total?fmt(shown/total):1;
 return share<minimum?{code:'hidden',message:`${id}: apenas ${Math.round(share*100)}% visível`,measured:share,limit:minimum}:null;
}
export function evaluateBody(id:string,headShare:number,shoulderWidth:number):FitReport{
 const issues:FitIssue[]=[],[minShare,maxShare]=BODY_PROPORTIONS.headShare,[minWidth,maxWidth]=BODY_PROPORTIONS.shoulderWidth;
 if(headShare<minShare||headShare>maxShare)issues.push({code:'proportion',message:`Cabeça ocupa ${Math.round(headShare*100)}% da altura; faixa ${minShare*100}–${maxShare*100}%`,measured:fmt(headShare),limit:headShare<minShare?minShare:maxShare});
 if(shoulderWidth<minWidth||shoulderWidth>maxWidth)issues.push({code:'proportion',message:`Ombros com ${fmt(shoulderWidth)}× a cabeça; faixa ${minWidth}–${maxWidth}×`,measured:fmt(shoulderWidth),limit:shoulderWidth<minWidth?minWidth:maxWidth});
 return {id,bounds:null,widthRatio:fmt(shoulderWidth),issues};
}
