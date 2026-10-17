import {DYES} from '../../shared/catalog';
import type {Equipment} from '../../shared/catalog';
import {cutRegion,drawPinned} from './rig/draw';
import {COSMETIC_MANIFEST,coversHair} from './rig/manifest';
import type {ArtRegion} from './rig/manifest';

export type HeadwearProfile='covered'|'open';
/** Wearing art is registered to the scalp through its manifest pin, independently from shop icon bounds. */
const wornRegion=(id:string):ArtRegion|undefined=>{const manifest=COSMETIC_MANIFEST[id];return manifest?.slot==='hat'?manifest.worn:undefined;};
const atlases=new Map<string,HTMLImageElement>();
const atlasFor=(path:string)=>{let image=atlases.get(path);if(!image){image=new Image();image.src=path;image.onload=()=>window.dispatchEvent(new Event('brasa-art-loaded'));atlases.set(path,image);}return image;};
if(typeof window!=='undefined')for(const manifest of Object.values(COSMETIC_MANIFEST))if(manifest.slot==='hat'&&manifest.worn)atlasFor(manifest.worn.atlas);
const ready=(image:HTMLImageElement)=>image.complete&&image.naturalWidth>0;
const tinted=new Map<string,HTMLCanvasElement>();
const portraits=new Map<string,HTMLCanvasElement>();

export const hasWornHat=(id:string):boolean=>!!wornRegion(id);
export function getWornHatPortrait(id:string):HTMLCanvasElement|null {
 const region=wornRegion(id);if(!region)return null;const atlas=atlasFor(region.atlas);if(!ready(atlas))return null;
 let portrait=portraits.get(id);if(!portrait){portrait=cutRegion(atlas,region);portraits.set(id,portrait);}
 return portrait;
}

export function getHeadwearProfile(eq:Equipment):HeadwearProfile {
 return coversHair(COSMETIC_MANIFEST[eq.hat]?.profile)?'covered':'open';
}

function artFor(eq:Equipment,atlas:HTMLImageElement):CanvasImageSource&{width:number;height:number} {
 const color=DYES.find(d=>d.id===eq.dyes?.hat&&d.id!=='original')?.color;
 if(!color)return atlas;
 const key=`${atlas.src}:${color}`;let art=tinted.get(key);
 if(!art){
  art=document.createElement('canvas');art.width=atlas.naturalWidth;art.height=atlas.naturalHeight;
  const c=art.getContext('2d')!;c.drawImage(atlas,0,0);c.globalCompositeOperation='color';c.fillStyle=color;c.fillRect(0,0,art.width,art.height);
  c.globalCompositeOperation='destination-in';c.drawImage(atlas,0,0);tinted.set(key,art);
 }
 return art;
}

/** True means the painted hat owns this item, including while its image loads. */
export function drawWornHat(c:CanvasRenderingContext2D,eq:Equipment):boolean {
 const region=wornRegion(eq.hat);if(!region)return false;
 const atlas=atlasFor(region.atlas);if(!ready(atlas))return true;
 drawPinned(c,artFor(eq,atlas),region);
 return true;
}
