import type {ArtRegion} from './manifest';
import {scaledCopy} from '../spriteCache';

const UNIT=160/1254;
type Art=CanvasImageSource&{width:number;height:number};
/** The only placement path for painted head cosmetics: two art points onto two template points.
 * `preCut` art already holds just `region.source` (clipped, tinted, possibly downsampled). */
export function drawPinned(c:CanvasRenderingContext2D,art:Art,region:ArtRegion,preCut=false){
 const {source:[sx,sy,sw,sh],pin:{from:[a,b],to:[A,B]}}=region;
 const dx=b[0]-a[0],dy=b[1]-a[1],tx=B[0]-A[0],ty=B[1]-A[1],den=dx*dx+dy*dy,p=(tx*dx+ty*dy)/den,q=(ty*dx-tx*dy)/den;
 c.save();c.translate((A[0]-625)*UNIT,(A[1]-1225)*UNIT);c.transform(p*UNIT,q*UNIT,-q*UNIT,p*UNIT,0,0);
 if(!preCut&&region.clip){c.beginPath();region.clip.forEach(([x,y],index)=>index?c.lineTo(x-a[0],y-a[1]):c.moveTo(x-a[0],y-a[1]));c.closePath();c.clip();}
 // Pre-cut art (hair, hats, glasses: a few hundred px) is shown a few dozen px wide: draw a copy already at that size,
 // or every head on screen makes the browser filter the full painting again each frame (docs/performance.md, "Pescaria").
 if(preCut){const m=c.getTransform(),shown=art instanceof HTMLCanvasElement?scaledCopy(art,sw*Math.hypot(m.a,m.b))??art:art;if(shown!==art)c.imageSmoothingQuality='low';c.drawImage(shown,0,0,shown.width,shown.height,sx-a[0],sy-a[1],sw,sh);}
 else{c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(art,sx,sy,sw,sh,sx-a[0],sy-a[1],sw,sh);}
 c.restore();
}
/** Crops one region of an atlas, applying its clip in atlas coordinates. */
export function cutRegion(atlas:CanvasImageSource,region:ArtRegion):HTMLCanvasElement{
 const [x,y,w,h]=region.source,out=document.createElement('canvas');out.width=w;out.height=h;const c=out.getContext('2d')!;
 if(region.clip){c.beginPath();region.clip.forEach(([px,py],index)=>index?c.lineTo(px-x,py-y):c.moveTo(px-x,py-y));c.closePath();c.clip();}
 c.drawImage(atlas,x,y,w,h,0,0,w,h);return out;
}
